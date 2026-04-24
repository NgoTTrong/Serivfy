-- Branch
CREATE TABLE "Branch" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "address"      TEXT,
  "phone"        TEXT,
  "timezone"     TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Branch_restaurantId_isActive_idx" ON "Branch"("restaurantId", "isActive");
ALTER TABLE "Branch"
  ADD CONSTRAINT "Branch_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- branchId columns
ALTER TABLE "Staff"        ADD COLUMN "branchId" TEXT;
ALTER TABLE "Table"        ADD COLUMN "branchId" TEXT;
ALTER TABLE "TableSession" ADD COLUMN "branchId" TEXT;

-- Backfill: create one default "Chi nhánh chính" per existing restaurant
-- and attach all its tables + active/closed sessions to it. Staff rows
-- stay null (HQ-scoped) unless the tenant decides to scope them later.
INSERT INTO "Branch" ("id", "restaurantId", "name", "isActive", "createdAt")
SELECT
  'b_' || substr(md5(random()::text || r."id"), 1, 24),
  r."id",
  'Chi nhánh chính',
  true,
  NOW()
FROM "Restaurant" r
WHERE NOT EXISTS (
  SELECT 1 FROM "Branch" b WHERE b."restaurantId" = r."id"
);

UPDATE "Table" t
SET "branchId" = b."id"
FROM "Branch" b
WHERE b."restaurantId" = t."restaurantId"
  AND t."branchId" IS NULL;

UPDATE "TableSession" s
SET "branchId" = t."branchId"
FROM "Table" t
WHERE t."id" = s."tableId"
  AND s."branchId" IS NULL;

-- Indexes + FKs
CREATE INDEX "Staff_restaurantId_branchId_idx"  ON "Staff"("restaurantId", "branchId");
CREATE INDEX "Table_branchId_idx"               ON "Table"("branchId");

ALTER TABLE "Staff"
  ADD CONSTRAINT "Staff_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Table"
  ADD CONSTRAINT "Table_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TableSession"
  ADD CONSTRAINT "TableSession_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
