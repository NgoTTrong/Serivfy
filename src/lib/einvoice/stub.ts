import crypto from "node:crypto";
import type { EInvoiceProvider, IssueParams, IssueResult } from "./types";

/**
 * Stub provider — issues a deterministic fake invoice without calling any
 * external service. Used for:
 *   - Local dev & CI
 *   - Restaurants that need the internal workflow but haven't onboarded
 *     with a real provider yet
 *   - Integration tests of the close-bill → einvoice pipeline
 *
 * All future real providers should conform to the same IssueResult shape.
 */
export const stubProvider: EInvoiceProvider = {
  name: "STUB",
  async issue(params: IssueParams): Promise<IssueResult> {
    // Deterministic pseudo number: yymm + short hash of sessionId.
    const d = params.issuedAt;
    const yymm = `${d.getFullYear().toString().slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}`;
    const hash = crypto
      .createHash("sha1")
      .update(params.sessionId)
      .digest("hex")
      .slice(0, 6)
      .toUpperCase();
    return {
      ok: true,
      providerInvoiceId: `STUB-${yymm}-${hash}`,
      invoiceNumber: String(parseInt(hash, 16) % 1_000_000).padStart(7, "0"),
      invoiceSeries: params.providerConfig.seriesCode ?? `K${yymm}TAA`,
      pdfUrl: null,
      xmlUrl: null,
      raw: { note: "stub-provider; no external call" },
    };
  },
};
