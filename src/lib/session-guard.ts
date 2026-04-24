import { prisma } from "./prisma";
import { prismaDirect } from "./prisma-direct";
import { bumpPulse } from "./pulse";

export async function getActiveSessionByToken(token: string) {
  return prisma.tableSession.findUnique({
    where: { token },
    include: {
      restaurant: true,
      table: true,
    },
  });
}

/**
 * Atomically find-or-create the ACTIVE TableSession for a scanned QR.
 *
 * Without serialization two simultaneous QR scans produced two ACTIVE sessions
 * for the same table. We now combine:
 *   - Postgres advisory xact lock keyed by tableId (prevents the race).
 *   - Partial unique index on (tableId) WHERE status='ACTIVE' (safety net).
 *
 * Uses the direct (non-pooled) client because advisory locks scope to a
 * transaction and PgBouncer's transaction-pooling mode can recycle the
 * connection mid-flight.
 */
export async function findOrCreateSessionForTable(qrToken: string) {
  const table = await prisma.table.findUnique({
    where: { qrToken },
    include: { restaurant: true },
  });
  if (!table || !table.isActive) return null;
  return findOrCreateSessionForTableRow(table.id, table.restaurantId);
}

/**
 * Staff/POS-side variant: the caller already has a trusted tableId + owning
 * restaurantId (verified by their session) and does not need the QR token.
 * Shares the advisory-lock + partial-unique-index guarantees with the
 * QR scan flow so a QR scan and a POS open can't produce two sessions.
 */
export async function findOrCreateSessionForTableId(
  tableId: string,
  restaurantId: string,
) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId },
  });
  if (!table || !table.isActive) return null;
  return findOrCreateSessionForTableRow(table.id, table.restaurantId);
}

async function findOrCreateSessionForTableRow(tableId: string, restaurantId: string) {
  // Hydrate branchId from the Table row so the session carries it forward.
  // If Table.branchId is null (legacy rows before migration), the session
  // also stays null — downstream branch-scoped queries treat null as HQ.
  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table) return null;

  const { session, created } = await prismaDirect.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      `svf:table:${tableId}`,
    );
    const active = await tx.tableSession.findFirst({
      where: { tableId, status: "ACTIVE" },
    });
    if (active) return { session: active, created: false };
    const fresh = await tx.tableSession.create({
      data: { tableId, restaurantId, branchId: table.branchId },
    });
    return { session: fresh, created: true };
  });

  if (created) {
    await bumpPulse(restaurantId, "tables");
  }
  return { table, session };
}
