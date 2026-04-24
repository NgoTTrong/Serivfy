-- Receipt number uniqueness per tenant. Null values are NOT covered by
-- regular UNIQUE, which is exactly what we want — open sessions have no
-- receipt number yet and shouldn't collide with anything.
CREATE UNIQUE INDEX "TableSession_restaurantId_receiptNumber_key"
  ON "TableSession"("restaurantId", "receiptNumber")
  WHERE "receiptNumber" IS NOT NULL;
