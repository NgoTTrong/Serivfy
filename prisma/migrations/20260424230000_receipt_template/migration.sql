CREATE TABLE "ReceiptTemplate" (
  "restaurantId"    TEXT NOT NULL,
  "headerName"      TEXT,
  "headerTagline"   TEXT,
  "logoUrl"         TEXT,
  "showAddress"     BOOLEAN NOT NULL DEFAULT true,
  "showPhone"       BOOLEAN NOT NULL DEFAULT true,
  "showTaxCode"     BOOLEAN NOT NULL DEFAULT true,
  "showItemOptions" BOOLEAN NOT NULL DEFAULT true,
  "showVietQr"      BOOLEAN NOT NULL DEFAULT true,
  "footerText"      TEXT,
  "footerSecondary" TEXT,
  "fontScale"       TEXT NOT NULL DEFAULT 'normal',
  "paperWidth"      INTEGER NOT NULL DEFAULT 80,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReceiptTemplate_pkey" PRIMARY KEY ("restaurantId")
);

ALTER TABLE "ReceiptTemplate"
  ADD CONSTRAINT "ReceiptTemplate_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
