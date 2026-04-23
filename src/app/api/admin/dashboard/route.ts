import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [sessionsToday, activeSessions, itemsToday] = await Promise.all([
    prisma.tableSession.count({
      where: { restaurantId: staff.restaurantId, openedAt: { gte: startOfDay } },
    }),
    prisma.tableSession.count({
      where: { restaurantId: staff.restaurantId, status: "ACTIVE" },
    }),
    prisma.orderItem.findMany({
      where: {
        round: { session: { restaurantId: staff.restaurantId } },
        createdAt: { gte: startOfDay },
      },
      select: { quantity: true, priceAtOrder: true, createdAt: true },
    }),
  ]);

  let revenue = 0;
  let units = 0;
  const byHour: Record<number, number> = {};
  for (const it of itemsToday) {
    revenue += it.quantity * it.priceAtOrder;
    units += it.quantity;
    const h = new Date(it.createdAt).getHours();
    byHour[h] = (byHour[h] || 0) + it.quantity * it.priceAtOrder;
  }

  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: byHour[h] || 0 }));

  return NextResponse.json({
    sessionsToday,
    activeSessions,
    revenueToday: revenue,
    unitsToday: units,
    hourly,
  });
}
