-- Shift + ShiftMovement
CREATE TABLE "Shift" (
  "id"                   TEXT NOT NULL,
  "restaurantId"         TEXT NOT NULL,
  "branchId"             TEXT,
  "openedByStaffId"      TEXT NOT NULL,
  "openedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "openingCash"          INTEGER NOT NULL DEFAULT 0,
  "note"                 TEXT,
  "status"               TEXT NOT NULL DEFAULT 'OPEN',
  "closedByStaffId"      TEXT,
  "closedAt"             TIMESTAMP(3),
  "closingCashActual"    INTEGER,
  "closingCashExpected"  INTEGER,
  "closingNote"          TEXT,
  CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Shift_restaurantId_status_idx" ON "Shift"("restaurantId", "status");
CREATE INDEX "Shift_restaurantId_openedAt_idx" ON "Shift"("restaurantId", "openedAt");

CREATE TABLE "ShiftMovement" (
  "id"               TEXT NOT NULL,
  "shiftId"          TEXT NOT NULL,
  "kind"             TEXT NOT NULL,
  "amount"           INTEGER NOT NULL,
  "paymentMethod"    TEXT,
  "sessionId"        TEXT,
  "note"             TEXT,
  "createdByStaffId" TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ShiftMovement_shiftId_createdAt_idx" ON "ShiftMovement"("shiftId", "createdAt");

ALTER TABLE "Shift"
  ADD CONSTRAINT "Shift_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Shift_openedByStaffId_fkey"
    FOREIGN KEY ("openedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "Shift_closedByStaffId_fkey"
    FOREIGN KEY ("closedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShiftMovement"
  ADD CONSTRAINT "ShiftMovement_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Partial unique: at most 1 OPEN shift per restaurant (+ branch) at a time.
CREATE UNIQUE INDEX "Shift_open_unique"
  ON "Shift"("restaurantId", COALESCE("branchId", ''))
  WHERE "status" = 'OPEN';
