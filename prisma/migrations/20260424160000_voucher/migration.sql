-- TableSession: discount denormalization
ALTER TABLE "TableSession"
  ADD COLUMN "discountAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "voucherCode" TEXT,
  ADD COLUMN "voucherLabel" TEXT;

-- Voucher
CREATE TABLE "Voucher" (
  "id"             TEXT NOT NULL,
  "restaurantId"   TEXT NOT NULL,
  "code"           TEXT NOT NULL,
  "label"          TEXT NOT NULL,
  "kind"           TEXT NOT NULL,
  "value"          INTEGER NOT NULL,
  "minOrderVND"    INTEGER,
  "maxDiscountVND" INTEGER,
  "startAt"        TIMESTAMP(3),
  "endAt"          TIMESTAMP(3),
  "totalLimit"     INTEGER,
  "usageCount"     INTEGER NOT NULL DEFAULT 0,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Voucher_restaurantId_code_key" ON "Voucher"("restaurantId", "code");
CREATE INDEX "Voucher_restaurantId_isActive_idx" ON "Voucher"("restaurantId", "isActive");

-- VoucherRedemption
CREATE TABLE "VoucherRedemption" (
  "id"           TEXT NOT NULL,
  "voucherId"    TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "sessionId"    TEXT NOT NULL,
  "voucherCode"  TEXT NOT NULL,
  "voucherLabel" TEXT NOT NULL,
  "discountAmt"  INTEGER NOT NULL,
  "appliedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "committedAt"  TIMESTAMP(3),
  CONSTRAINT "VoucherRedemption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VoucherRedemption_sessionId_key" ON "VoucherRedemption"("sessionId");
CREATE INDEX "VoucherRedemption_voucherId_idx" ON "VoucherRedemption"("voucherId");

ALTER TABLE "Voucher"
  ADD CONSTRAINT "Voucher_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VoucherRedemption"
  ADD CONSTRAINT "VoucherRedemption_voucherId_fkey"
    FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "VoucherRedemption_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "TableSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
