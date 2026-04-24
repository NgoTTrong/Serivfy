-- Station: bếp nóng / bếp lạnh / bar
CREATE TABLE "Station" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "branchId"     TEXT,
  "name"         TEXT NOT NULL,
  "order"        INTEGER NOT NULL DEFAULT 0,
  "printerId"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Station_restaurantId_idx" ON "Station"("restaurantId");

-- PrintAgent: Windows tray bridge
CREATE TABLE "PrintAgent" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "branchId"     TEXT,
  "name"         TEXT NOT NULL,
  "tokenHash"    TEXT NOT NULL,
  "version"      TEXT,
  "lastSeenAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt"    TIMESTAMP(3),
  CONSTRAINT "PrintAgent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrintAgent_tokenHash_key" ON "PrintAgent"("tokenHash");
CREATE INDEX "PrintAgent_restaurantId_idx" ON "PrintAgent"("restaurantId");

-- PrintPairing: short-lived 6-digit bootstrap code
CREATE TABLE "PrintPairing" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "branchId"     TEXT,
  "agentName"    TEXT NOT NULL,
  "code"         TEXT NOT NULL,
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "consumedAt"   TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PrintPairing_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PrintPairing_code_key" ON "PrintPairing"("code");
CREATE INDEX "PrintPairing_restaurantId_expiresAt_idx" ON "PrintPairing"("restaurantId", "expiresAt");

-- Printer: physical device managed by an agent
CREATE TABLE "Printer" (
  "id"            TEXT NOT NULL,
  "restaurantId"  TEXT NOT NULL,
  "branchId"      TEXT,
  "agentId"       TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "kind"          TEXT NOT NULL,
  "usbVendorId"   INTEGER,
  "usbProductId"  INTEGER,
  "networkHost"   TEXT,
  "networkPort"   INTEGER DEFAULT 9100,
  "bluetoothAddr" TEXT,
  "paperWidth"    INTEGER NOT NULL DEFAULT 80,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt"    TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Printer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Printer_restaurantId_kind_idx" ON "Printer"("restaurantId", "kind");
CREATE INDEX "Printer_agentId_idx" ON "Printer"("agentId");

-- PrintJob: queued work for an agent
CREATE TABLE "PrintJob" (
  "id"           TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "branchId"     TEXT,
  "printerId"    TEXT NOT NULL,
  "kind"         TEXT NOT NULL,
  "payload"      TEXT NOT NULL,
  "sessionId"    TEXT,
  "roundId"      TEXT,
  "status"       TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts"     INTEGER NOT NULL DEFAULT 0,
  "lastError"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMP(3),
  "processedAt"  TIMESTAMP(3),
  CONSTRAINT "PrintJob_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PrintJob_printerId_status_createdAt_idx" ON "PrintJob"("printerId", "status", "createdAt");
CREATE INDEX "PrintJob_restaurantId_createdAt_idx" ON "PrintJob"("restaurantId", "createdAt");

-- MenuItem: which station this dish prints to
ALTER TABLE "MenuItem" ADD COLUMN "stationId" TEXT;
CREATE INDEX "MenuItem_stationId_idx" ON "MenuItem"("stationId");

-- FKs
ALTER TABLE "Station"
  ADD CONSTRAINT "Station_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Station_printerId_fkey"
    FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PrintAgent"
  ADD CONSTRAINT "PrintAgent_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Printer"
  ADD CONSTRAINT "Printer_restaurantId_fkey"
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "Printer_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "PrintAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PrintJob"
  ADD CONSTRAINT "PrintJob_printerId_fkey"
    FOREIGN KEY ("printerId") REFERENCES "Printer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MenuItem"
  ADD CONSTRAINT "MenuItem_stationId_fkey"
    FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
