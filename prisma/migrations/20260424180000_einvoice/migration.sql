-- EInvoiceConfig (1:1 restaurant)
CREATE TABLE "EInvoiceConfig" (
  "restaurantId" TEXT NOT NULL,
  "provider"     TEXT NOT NULL DEFAULT 'STUB',
  "apiEndpoint"  TEXT,
  "apiUsername"  TEXT,
  "apiPassword"  TEXT,
  "taxCode"      TEXT,
  "templateCode" TEXT,
  "seriesCode"   TEXT,
  "isEnabled"    BOOLEAN NOT NULL DEFAULT false,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EInvoiceConfig_pkey" PRIMARY KEY ("restaurantId")
);
ALTER TABLE "EInvoiceConfig"
  ADD CONSTRAINT "EInvoiceConfig_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EInvoice
CREATE TABLE "EInvoice" (
  "id"                TEXT NOT NULL,
  "restaurantId"      TEXT NOT NULL,
  "sessionId"         TEXT NOT NULL,
  "provider"          TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'PENDING',
  "providerInvoiceId" TEXT,
  "invoiceNumber"     TEXT,
  "invoiceSeries"     TEXT,
  "pdfUrl"            TEXT,
  "xmlUrl"            TEXT,
  "issuedAt"          TIMESTAMP(3),
  "attempts"          INTEGER NOT NULL DEFAULT 0,
  "lastError"         TEXT,
  "rawResponse"       TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EInvoice_sessionId_key" ON "EInvoice"("sessionId");
CREATE INDEX "EInvoice_restaurantId_status_createdAt_idx" ON "EInvoice"("restaurantId", "status", "createdAt");

ALTER TABLE "EInvoice"
  ADD CONSTRAINT "EInvoice_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EInvoice_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
