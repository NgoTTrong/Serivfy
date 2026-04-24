-- Restaurant: Casso webhook secret
ALTER TABLE "Restaurant" ADD COLUMN "cassoWebhookSecret" TEXT;

-- Tenant audit log
CREATE TABLE "TenantAuditLog" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "actorStaffId" TEXT,
  "actorName"    TEXT,
  "action"       TEXT NOT NULL,
  "target"       TEXT,
  "meta"         TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TenantAuditLog_restaurantId_createdAt_idx" ON "TenantAuditLog"("restaurantId", "createdAt");
CREATE INDEX "TenantAuditLog_restaurantId_action_idx" ON "TenantAuditLog"("restaurantId", "action");

ALTER TABLE "TenantAuditLog"
  ADD CONSTRAINT "TenantAuditLog_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bank transactions
CREATE TABLE "BankTransaction" (
  "id"               TEXT NOT NULL,
  "restaurantId"     TEXT NOT NULL,
  "provider"         TEXT NOT NULL,
  "providerTxId"     TEXT NOT NULL,
  "amount"           INTEGER NOT NULL,
  "description"      TEXT NOT NULL,
  "bankAbbr"         TEXT,
  "counterparty"     TEXT,
  "receivedAt"       TIMESTAMP(3) NOT NULL,
  "rawPayload"       TEXT NOT NULL,
  "matchedSessionId" TEXT,
  "matchStatus"      TEXT NOT NULL DEFAULT 'UNMATCHED',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BankTransaction_provider_providerTxId_key" ON "BankTransaction"("provider", "providerTxId");
CREATE INDEX "BankTransaction_restaurantId_receivedAt_idx" ON "BankTransaction"("restaurantId", "receivedAt");
CREATE INDEX "BankTransaction_restaurantId_matchStatus_idx" ON "BankTransaction"("restaurantId", "matchStatus");

ALTER TABLE "BankTransaction"
  ADD CONSTRAINT "BankTransaction_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
