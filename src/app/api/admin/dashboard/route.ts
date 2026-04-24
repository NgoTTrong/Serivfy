import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { addDays, DEFAULT_TZ, tzDayStart } from "@/lib/tz";

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: staff.restaurantId },
    select: { timezone: true },
  });
  const tz = restaurant.timezone ?? DEFAULT_TZ;
  const restaurantId = staff.restaurantId;
  const now = new Date();
  const from = tzDayStart(now, tz);
  const to = addDays(from, 1);

  const [sessionsToday, activeSessions, totalsRow, hourlyRows] = await Promise.all([
    prisma.tableSession.count({
      where: { restaurantId, openedAt: { gte: from, lt: to } },
    }),
    prisma.tableSession.count({
      where: { restaurantId, status: "ACTIVE" },
    }),
    prisma.$queryRaw<
      Array<{ revenue: bigint | null; units: bigint | null }>
    >`
      SELECT
        COALESCE(SUM(oi."priceAtOrder" * oi."quantity"), 0)::bigint AS revenue,
        COALESCE(SUM(oi."quantity"), 0)::bigint AS units
      FROM "OrderItem" oi
      JOIN "OrderRound" r ON r.id = oi."roundId"
      JOIN "TableSession" s ON s.id = r."sessionId"
      WHERE s."restaurantId" = ${restaurantId}
        AND oi."createdAt" >= ${from}
        AND oi."createdAt" <  ${to}
    `,
    prisma.$queryRaw<
      Array<{ hour: number; revenue: bigint }>
    >`
      SELECT
        EXTRACT(HOUR FROM oi."createdAt" AT TIME ZONE ${tz})::int AS hour,
        SUM(oi."priceAtOrder" * oi."quantity")::bigint AS revenue
      FROM "OrderItem" oi
      JOIN "OrderRound" r ON r.id = oi."roundId"
      JOIN "TableSession" s ON s.id = r."sessionId"
      WHERE s."restaurantId" = ${restaurantId}
        AND oi."createdAt" >= ${from}
        AND oi."createdAt" <  ${to}
      GROUP BY 1
    `,
  ]);

  const totals = totalsRow[0] ?? { revenue: 0n, units: 0n };
  const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0 }));
  for (const row of hourlyRows) hourly[row.hour].revenue = Number(row.revenue);

  return NextResponse.json({
    sessionsToday,
    activeSessions,
    revenueToday: Number(totals.revenue ?? 0n),
    unitsToday: Number(totals.units ?? 0n),
    hourly,
  });
}
