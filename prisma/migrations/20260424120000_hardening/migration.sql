-- Restaurant: timezone + tokenVersion
ALTER TABLE "Restaurant"
  ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Staff: isActive + tokenVersion (for JWT revoke without waiting 14d)
ALTER TABLE "Staff"
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- Soft-delete cols on Category / MenuItem
ALTER TABLE "Category" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "MenuItem" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE INDEX "Category_restaurantId_deletedAt_idx" ON "Category"("restaurantId", "deletedAt");
CREATE INDEX "MenuItem_restaurantId_deletedAt_idx"  ON "MenuItem"("restaurantId", "deletedAt");

-- Unique roundNumber per session (prevents dup rounds under concurrent submit)
CREATE UNIQUE INDEX "OrderRound_sessionId_roundNumber_key"
  ON "OrderRound"("sessionId", "roundNumber");

-- Partial unique index: at most 1 ACTIVE session per table.
-- Safety net even if app-level lock is bypassed.
CREATE UNIQUE INDEX "TableSession_tableId_active_unique"
  ON "TableSession"("tableId")
  WHERE "status" = 'ACTIVE';

-- Pulse counters — cheap poll-vs-change check.
CREATE TABLE "RestaurantPulse" (
  "restaurantId"    TEXT NOT NULL,
  "kitchenVersion"  INTEGER NOT NULL DEFAULT 0,
  "tablesVersion"   INTEGER NOT NULL DEFAULT 0,
  "menuVersion"     INTEGER NOT NULL DEFAULT 0,
  "customerVersion" INTEGER NOT NULL DEFAULT 0,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RestaurantPulse_pkey" PRIMARY KEY ("restaurantId")
);

-- Durable rate-limit buckets (replaces in-memory Map in middleware).
CREATE TABLE "RateLimit" (
  "key" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "resetAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");
