-- Reusable modifier templates
CREATE TABLE "ModifierTemplate" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "required"     BOOLEAN NOT NULL DEFAULT false,
  "multiple"     BOOLEAN NOT NULL DEFAULT false,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "deletedAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModifierTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ModifierTemplate_restaurantId_deletedAt_idx" ON "ModifierTemplate"("restaurantId", "deletedAt");

CREATE TABLE "ModifierTemplateChoice" (
  "id"         TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "priceDelta" INTEGER NOT NULL DEFAULT 0,
  "order"      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ModifierTemplateChoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MenuItemModifier" (
  "menuItemId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "order"      INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "MenuItemModifier_pkey" PRIMARY KEY ("menuItemId", "templateId")
);
CREATE INDEX "MenuItemModifier_templateId_idx" ON "MenuItemModifier"("templateId");

ALTER TABLE "ModifierTemplate"
  ADD CONSTRAINT "ModifierTemplate_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModifierTemplateChoice"
  ADD CONSTRAINT "ModifierTemplateChoice_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ModifierTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItemModifier"
  ADD CONSTRAINT "MenuItemModifier_menuItemId_fkey"
    FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MenuItemModifier_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ModifierTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
