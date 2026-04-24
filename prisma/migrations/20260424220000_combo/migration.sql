-- MenuCombo
CREATE TABLE "MenuCombo" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "price"        INTEGER NOT NULL,
  "image"        TEXT,
  "isAvailable"  BOOLEAN NOT NULL DEFAULT true,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "deletedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MenuCombo_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MenuCombo_restaurantId_deletedAt_idx" ON "MenuCombo"("restaurantId", "deletedAt");

CREATE TABLE "MenuComboItem" (
  "id"         TEXT NOT NULL,
  "comboId"    TEXT NOT NULL,
  "menuItemId" TEXT NOT NULL,
  "quantity"   INTEGER NOT NULL DEFAULT 1,
  "note"       TEXT,
  "order"      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "MenuComboItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MenuComboItem_comboId_idx"    ON "MenuComboItem"("comboId");
CREATE INDEX "MenuComboItem_menuItemId_idx" ON "MenuComboItem"("menuItemId");

ALTER TABLE "MenuCombo"
  ADD CONSTRAINT "MenuCombo_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuComboItem"
  ADD CONSTRAINT "MenuComboItem_comboId_fkey"
    FOREIGN KEY ("comboId") REFERENCES "MenuCombo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MenuComboItem_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- OrderItem / CartItem: comboId snapshot
ALTER TABLE "OrderItem" ADD COLUMN "comboId" TEXT;
ALTER TABLE "CartItem"  ADD COLUMN "comboId" TEXT;
CREATE INDEX "OrderItem_comboId_idx" ON "OrderItem"("comboId");
CREATE INDEX "CartItem_comboId_idx"  ON "CartItem"("comboId");
