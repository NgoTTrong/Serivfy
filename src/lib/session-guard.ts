import { prisma } from "./prisma";

export async function getActiveSessionByToken(token: string) {
  return prisma.tableSession.findUnique({
    where: { token },
    include: {
      restaurant: true,
      table: true,
    },
  });
}

export async function findOrCreateSessionForTable(qrToken: string) {
  const table = await prisma.table.findUnique({
    where: { qrToken },
    include: { restaurant: true },
  });
  if (!table || !table.isActive) return null;

  const active = await prisma.tableSession.findFirst({
    where: { tableId: table.id, status: "ACTIVE" },
  });
  if (active) return { table, session: active };

  const created = await prisma.tableSession.create({
    data: {
      tableId: table.id,
      restaurantId: table.restaurantId,
    },
  });
  return { table, session: created };
}
