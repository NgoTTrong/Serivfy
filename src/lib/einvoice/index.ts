import { prisma } from "../prisma";
import { logger } from "../logger";
import { stubProvider } from "./stub";
import { misaProvider } from "./misa";
import type { EInvoiceProvider, IssueParams, IssueResult } from "./types";

export { stubProvider, misaProvider };
export type { EInvoiceProvider, IssueParams, IssueResult };

/**
 * Registry: plug real providers here as they're onboarded. Keeping the
 * lookup here (vs dynamic imports) so treeshakers see every provider and
 * the compiler verifies all conform to the interface.
 */
const providers: Record<string, EInvoiceProvider> = {
  STUB: stubProvider,
  MISA: misaProvider,
  // VIETTEL: viettelProvider,   // TODO: SInvoice
  // VNPT: vnptProvider,         // TODO
  // EASYINVOICE: easyInvoiceProvider,
  // HILO: hiloProvider,
};

export function getProvider(name: string): EInvoiceProvider {
  return providers[name] ?? providers.STUB;
}

/**
 * Best-effort async issuance. Called fire-and-forget from close-bill when
 * the tenant has e-invoicing enabled. Creates an EInvoice row immediately
 * so the UI can show PENDING status, then calls the provider and updates
 * the row with the result.
 *
 * No retry here — failed rows stay FAILED and admins can manually retry
 * via the admin endpoint, matching the mental model users have from other
 * POS systems.
 */
export async function issueEInvoiceForSession(sessionId: string): Promise<void> {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          address: true,
          taxCode: true,
          eInvoiceConfig: true,
        },
      },
      table: { select: { label: true } },
      rounds: {
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
        },
      },
    },
  });
  if (!session || !session.restaurant.eInvoiceConfig?.isEnabled) return;

  const cfg = session.restaurant.eInvoiceConfig;
  const provider = getProvider(cfg.provider);

  // Build line items + totals from the session snapshot.
  const items = [] as IssueParams["items"];
  let subtotal = 0;
  for (const r of session.rounds) {
    for (const it of r.items) {
      const sub = it.priceAtOrder * it.quantity;
      subtotal += sub;
      items.push({
        name: it.menuItem.name,
        qty: it.quantity,
        unitPrice: it.priceAtOrder,
        subtotal: sub,
      });
    }
  }
  const total = Math.max(0, subtotal - session.discountAmount);

  // Upsert the invoice row so retries on an already-failed attempt replace
  // the previous result.
  const existing = await prisma.eInvoice.findUnique({ where: { sessionId } });
  const invoice = existing
    ? await prisma.eInvoice.update({
        where: { id: existing.id },
        data: {
          status: "SUBMITTED",
          attempts: { increment: 1 },
          lastError: null,
          provider: cfg.provider,
        },
      })
    : await prisma.eInvoice.create({
        data: {
          restaurantId: session.restaurant.id,
          sessionId,
          provider: cfg.provider,
          status: "SUBMITTED",
          attempts: 1,
        },
      });

  let result: IssueResult;
  try {
    result = await provider.issue({
      restaurantId: session.restaurant.id,
      sessionId,
      receiptNumber: session.receiptNumber ?? session.id.slice(-8).toUpperCase(),
      tableLabel: session.table.label,
      issuedAt: session.closedAt ?? new Date(),
      sellerTaxCode: session.restaurant.taxCode ?? cfg.taxCode ?? null,
      sellerName: session.restaurant.name,
      sellerAddress: session.restaurant.address,
      items,
      subtotal,
      discount: session.discountAmount,
      total,
      paymentMethod: session.paymentMethod,
      providerConfig: {
        apiEndpoint: cfg.apiEndpoint,
        apiUsername: cfg.apiUsername,
        apiPassword: cfg.apiPassword,
        templateCode: cfg.templateCode,
        seriesCode: cfg.seriesCode,
      },
    });
  } catch (e) {
    logger.error("einvoice.issue.exception", e, { sessionId, provider: cfg.provider });
    result = {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown error",
      retryable: true,
    };
  }

  if (result.ok) {
    await prisma.eInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "ISSUED",
        providerInvoiceId: result.providerInvoiceId,
        invoiceNumber: result.invoiceNumber,
        invoiceSeries: result.invoiceSeries,
        pdfUrl: result.pdfUrl ?? null,
        xmlUrl: result.xmlUrl ?? null,
        issuedAt: new Date(),
        rawResponse: result.raw ? JSON.stringify(result.raw) : null,
        lastError: null,
      },
    });
  } else {
    await prisma.eInvoice.update({
      where: { id: invoice.id },
      data: {
        status: "FAILED",
        lastError: result.error,
        rawResponse: result.raw ? JSON.stringify(result.raw) : null,
      },
    });
  }
}
