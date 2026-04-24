-- Guest (sessionId, deviceId) uniqueness — collapse any pre-existing dupes
-- by keeping the earliest row and deleting later ones. Safe because OrderItem
-- and CartItem FKs to Guest are nullable / cascade-safe.
DELETE FROM "Guest" g
USING "Guest" g2
WHERE g."sessionId" = g2."sessionId"
  AND g."deviceId"  = g2."deviceId"
  AND g."joinedAt"  > g2."joinedAt";

CREATE UNIQUE INDEX "Guest_sessionId_deviceId_key"
  ON "Guest"("sessionId", "deviceId");
