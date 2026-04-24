/**
 * Abstraction over Vietnamese e-invoice providers. Each real provider
 * (Viettel SInvoice, VNPT, Misa MeInvoice, EasyInvoice, Hilo) implements
 * this interface; config rows carry the per-tenant credentials.
 *
 * Using one small interface keeps switching costs low if a restaurant
 * migrates providers — which in practice happens when tax compliance rules
 * change or a cheaper provider enters the market.
 */

export type EInvoiceLineItem = {
  name: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
  unit?: string; // "lần", "phần", ... optional
};

export type IssueParams = {
  restaurantId: string;
  sessionId: string;
  receiptNumber: string;
  tableLabel: string;
  issuedAt: Date;
  sellerTaxCode: string | null;
  sellerName: string;
  sellerAddress: string | null;
  /** Customer info — for most F&B bills this is null (individual retail). */
  buyerName?: string | null;
  buyerTaxCode?: string | null;
  buyerAddress?: string | null;
  items: EInvoiceLineItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string | null;
  /** Provider-specific config from EInvoiceConfig row. */
  providerConfig: {
    apiEndpoint?: string | null;
    apiUsername?: string | null;
    apiPassword?: string | null;
    templateCode?: string | null;
    seriesCode?: string | null;
  };
};

export type IssueResult =
  | {
      ok: true;
      providerInvoiceId: string;
      invoiceNumber: string;
      invoiceSeries: string;
      pdfUrl?: string | null;
      xmlUrl?: string | null;
      raw?: unknown;
    }
  | {
      ok: false;
      error: string;
      retryable: boolean;
      raw?: unknown;
    };

export interface EInvoiceProvider {
  readonly name: string;
  issue(params: IssueParams): Promise<IssueResult>;
  /** Optional: providers that don't support programmatic cancel can no-op. */
  cancel?(providerInvoiceId: string, reason?: string): Promise<void>;
}
