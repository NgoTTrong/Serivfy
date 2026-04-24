import type { EInvoiceProvider, IssueParams, IssueResult } from "./types";
import { logger } from "../logger";

/**
 * Misa MeInvoice provider.
 *
 * Implements the public MeInvoice REST flow:
 *   1. POST /Account/Login          — exchange user/password for bearer token
 *   2. POST /Invoice/Create         — create invoice
 *
 * Real-world Misa deployments vary by reseller/version. This file targets
 * the v2 public API; if a tenant's MeInvoice instance returns differently-
 * shaped responses, adapt `parseLoginResponse` / `parseCreateResponse` at
 * the seams rather than rewriting the whole provider.
 *
 * Token caching: each process keeps one token per tenant keyed by the
 * (endpoint, username) tuple. Tokens are typically valid ~24h; on a 401
 * we wipe the cache and retry once with a fresh login.
 */

type TokenCache = { token: string; expiresAt: number };
const tokenCache = new Map<string, TokenCache>();

function cacheKey(endpoint: string, username: string) {
  return `${endpoint}::${username}`;
}

async function login(
  endpoint: string,
  username: string,
  password: string,
): Promise<string> {
  const key = cacheKey(endpoint, username);
  const cached = tokenCache.get(key);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const res = await fetch(`${endpoint.replace(/\/$/, "")}/Account/Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userName: username, password }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`MISA login ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json().catch(() => null)) as
    | { accessToken?: string; access_token?: string; expiresIn?: number; data?: { accessToken?: string } }
    | null;
  const token =
    json?.accessToken ?? json?.access_token ?? json?.data?.accessToken ?? null;
  if (!token) throw new Error("MISA login returned no token");

  // Assume ~22h if not specified, leaving headroom.
  const ttlMs = (json?.expiresIn ?? 22 * 3600) * 1000;
  tokenCache.set(key, { token, expiresAt: Date.now() + ttlMs });
  return token;
}

function buildInvoiceBody(params: IssueParams) {
  // Misa expects prices in VND (integer). The public schema uses camelCase
  // though some tenants see PascalCase — adjust in a single place if so.
  return {
    invoiceTemplateCode: params.providerConfig.templateCode ?? "",
    invoiceSeries: params.providerConfig.seriesCode ?? "",
    invoiceDate: params.issuedAt.toISOString(),
    sellerTaxCode: params.sellerTaxCode ?? "",
    sellerName: params.sellerName,
    sellerAddress: params.sellerAddress ?? "",
    buyerName: params.buyerName ?? "",
    buyerTaxCode: params.buyerTaxCode ?? "",
    buyerAddress: params.buyerAddress ?? "",
    paymentMethod: params.paymentMethod ?? "TM/CK",
    currency: "VND",
    exchangeRate: 1,
    totalAmountWithoutVAT: params.subtotal - params.discount,
    totalVATAmount: 0, // VAT engine plugs in here when we support tax rates
    totalAmount: params.total,
    discountAmount: params.discount,
    receiptNo: params.receiptNumber,
    items: params.items.map((it, idx) => ({
      lineNumber: idx + 1,
      itemName: it.name,
      unitName: it.unit ?? "phần",
      quantity: it.qty,
      unitPrice: it.unitPrice,
      amount: it.subtotal,
      vatRate: 0,
      vatAmount: 0,
      amountAfterVAT: it.subtotal,
    })),
  };
}

async function callCreate(
  endpoint: string,
  token: string,
  body: ReturnType<typeof buildInvoiceBody>,
): Promise<Response> {
  return fetch(`${endpoint.replace(/\/$/, "")}/Invoice/Create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

export const misaProvider: EInvoiceProvider = {
  name: "MISA",
  async issue(params: IssueParams): Promise<IssueResult> {
    const endpoint = params.providerConfig.apiEndpoint;
    const username = params.providerConfig.apiUsername;
    const password = params.providerConfig.apiPassword;
    if (!endpoint || !username || !password) {
      return {
        ok: false,
        error: "Thiếu cấu hình MISA: endpoint / username / password",
        retryable: false,
      };
    }

    let token: string;
    try {
      token = await login(endpoint, username, password);
    } catch (e) {
      logger.error("einvoice.misa.login.failed", e, {
        endpoint,
        sessionId: params.sessionId,
      });
      return {
        ok: false,
        error: e instanceof Error ? e.message : "login error",
        retryable: true,
      };
    }

    const body = buildInvoiceBody(params);
    let res: Response;
    try {
      res = await callCreate(endpoint, token, body);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "network error",
        retryable: true,
      };
    }

    if (res.status === 401) {
      // Cached token rejected — rotate and retry once.
      tokenCache.delete(cacheKey(endpoint, username));
      try {
        token = await login(endpoint, username, password);
        res = await callCreate(endpoint, token, body);
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : "relogin failed",
          retryable: true,
        };
      }
    }

    const raw = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        error: `MISA ${res.status}: ${JSON.stringify(raw).slice(0, 200)}`,
        retryable: res.status >= 500,
        raw,
      };
    }

    const data = (raw as
      | {
          invoiceId?: string;
          invoiceNumber?: string | number;
          invoiceSeries?: string;
          pdfUrl?: string;
          xmlUrl?: string;
          data?: {
            invoiceId?: string;
            invoiceNumber?: string | number;
            invoiceSeries?: string;
            pdfUrl?: string;
            xmlUrl?: string;
          };
        }
      | null)?.data ?? (raw as Record<string, unknown> | null);

    const providerInvoiceId =
      (data as { invoiceId?: string })?.invoiceId ?? "";
    const invoiceNumber = String(
      (data as { invoiceNumber?: string | number })?.invoiceNumber ?? "",
    );
    const invoiceSeries =
      (data as { invoiceSeries?: string })?.invoiceSeries ??
      params.providerConfig.seriesCode ??
      "";
    if (!providerInvoiceId) {
      return {
        ok: false,
        error: "MISA response missing invoiceId",
        retryable: false,
        raw,
      };
    }
    return {
      ok: true,
      providerInvoiceId,
      invoiceNumber,
      invoiceSeries,
      pdfUrl: (data as { pdfUrl?: string })?.pdfUrl ?? null,
      xmlUrl: (data as { xmlUrl?: string })?.xmlUrl ?? null,
      raw,
    };
  },
};
