import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { planOf } from "@/lib/plans";
import { addDays, DEFAULT_TZ, resolveRange } from "@/lib/tz";

type Range = "TODAY" | "WEEK" | "MONTH" | "CUSTOM";

export async function GET(req: NextRequest) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const r = (req.nextUrl.searchParams.get("range") ?? "TODAY").toUpperCase() as Range;
  const fromQ = req.nextUrl.searchParams.get("from");
  const toQ = req.nextUrl.searchParams.get("to");

  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: staff.restaurantId },
    select: { planTier: true, timezone: true },
  });
  const plan = planOf(restaurant.planTier);
  const tz = restaurant.timezone ?? DEFAULT_TZ;

  const canAdvanced = plan.limits.features.advancedReports;
  if ((r === "MONTH" || r === "CUSTOM") && !canAdvanced) {
    return NextResponse.json(
      {
        error: "PLAN_LIMIT",
        message: `Gói ${plan.label} chỉ xem được 7 ngày. Nâng cấp Pro để xem 30 ngày / khoảng tuỳ chọn.`,
      },
      { status: 402 },
    );
  }

  const { from, to } = resolveRange(r, tz, fromQ, toQ);
  const restaurantId = staff.restaurantId;

  // Totals in one pass on the DB.
  const totalsRows = await prisma.$queryRaw<
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
  `;
  const totals = totalsRows[0] ?? { revenue: 0n, units: 0n };
  const revenue = Number(totals.revenue ?? 0n);
  const units = Number(totals.units ?? 0n);

  // Discount attributed to sessions that paid in the range. Used for
  // gross-vs-net reconciliation. Joined on paidAt so we only count
  // redemptions that were committed by a real close-bill event.
  const discountRows = await prisma.$queryRaw<Array<{ d: bigint | null }>>`
    SELECT COALESCE(SUM("discountAmount"), 0)::bigint AS d
    FROM "TableSession"
    WHERE "restaurantId" = ${restaurantId}
      AND "paidAt" IS NOT NULL
      AND "paidAt" >= ${from}
      AND "paidAt" <  ${to}
  `;
  const discountTotal = Number(discountRows[0]?.d ?? 0n);
  const netRevenue = Math.max(0, revenue - discountTotal);

  // Daily / hourly / dow buckets — all time-bucketed in tenant tz on the DB.
  const dailyRows = await prisma.$queryRaw<
    Array<{ day: Date; revenue: bigint }>
  >`
    SELECT
      date_trunc('day', oi."createdAt" AT TIME ZONE ${tz})::date AS day,
      SUM(oi."priceAtOrder" * oi."quantity")::bigint AS revenue
    FROM "OrderItem" oi
    JOIN "OrderRound" r ON r.id = oi."roundId"
    JOIN "TableSession" s ON s.id = r."sessionId"
    WHERE s."restaurantId" = ${restaurantId}
      AND oi."createdAt" >= ${from}
      AND oi."createdAt" <  ${to}
    GROUP BY 1
    ORDER BY 1
  `;
  const dailyMap = new Map(
    dailyRows.map((d) => [
      new Date(d.day).toISOString().slice(0, 10),
      Number(d.revenue),
    ]),
  );

  const hourlyRows = await prisma.$queryRaw<
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
  `;
  const hourly = Array.from({ length: 24 }, () => 0);
  for (const h of hourlyRows) hourly[h.hour] = Number(h.revenue);

  const dowRows = await prisma.$queryRaw<
    Array<{ dow: number; revenue: bigint }>
  >`
    SELECT
      EXTRACT(DOW FROM oi."createdAt" AT TIME ZONE ${tz})::int AS dow,
      SUM(oi."priceAtOrder" * oi."quantity")::bigint AS revenue
    FROM "OrderItem" oi
    JOIN "OrderRound" r ON r.id = oi."roundId"
    JOIN "TableSession" s ON s.id = r."sessionId"
    WHERE s."restaurantId" = ${restaurantId}
      AND oi."createdAt" >= ${from}
      AND oi."createdAt" <  ${to}
    GROUP BY 1
  `;
  const dow = Array.from({ length: 7 }, () => 0);
  for (const d of dowRows) dow[d.dow] = Number(d.revenue);

  // Top / slow items — aggregated server-side, top N returned.
  const itemRows = await prisma.$queryRaw<
    Array<{
      menuItemId: string;
      name: string;
      image: string | null;
      qty: bigint;
      revenue: bigint;
    }>
  >`
    SELECT
      oi."menuItemId" AS "menuItemId",
      mi."name" AS name,
      mi."image" AS image,
      SUM(oi."quantity")::bigint AS qty,
      SUM(oi."priceAtOrder" * oi."quantity")::bigint AS revenue
    FROM "OrderItem" oi
    JOIN "OrderRound" r ON r.id = oi."roundId"
    JOIN "TableSession" s ON s.id = r."sessionId"
    JOIN "MenuItem" mi ON mi.id = oi."menuItemId"
    WHERE s."restaurantId" = ${restaurantId}
      AND oi."createdAt" >= ${from}
      AND oi."createdAt" <  ${to}
    GROUP BY oi."menuItemId", mi."name", mi."image"
  `;
  const itemList = itemRows.map((it) => ({
    menuItemId: it.menuItemId,
    name: it.name,
    image: it.image,
    qty: Number(it.qty),
    revenue: Number(it.revenue),
  }));
  const topItems = [...itemList].sort((a, b) => b.qty - a.qty).slice(0, 10);
  const slowItems = [...itemList].sort((a, b) => a.qty - b.qty).slice(0, 10);

  // Sessions summary (AOV + avg duration).
  const sessionRows = await prisma.$queryRaw<
    Array<{
      cnt: bigint;
      paid: bigint;
      durSum: bigint | null;
      durCnt: bigint;
    }>
  >`
    SELECT
      COUNT(*)::bigint AS cnt,
      COALESCE(SUM("paidAmount"), 0)::bigint AS paid,
      SUM(
        CASE WHEN "closedAt" IS NOT NULL
             THEN EXTRACT(EPOCH FROM ("closedAt" - "openedAt"))::bigint
             ELSE NULL END
      ) AS "durSum",
      COUNT(CASE WHEN "closedAt" IS NOT NULL THEN 1 END)::bigint AS "durCnt"
    FROM "TableSession"
    WHERE "restaurantId" = ${restaurantId}
      AND "paidAt" IS NOT NULL
      AND "paidAt" >= ${from}
      AND "paidAt" <  ${to}
  `;
  const sRow = sessionRows[0];
  const sessionsCompleted = Number(sRow?.cnt ?? 0n);
  const paidRevenue = Number(sRow?.paid ?? 0n);
  const aov = sessionsCompleted > 0 ? Math.round(paidRevenue / sessionsCompleted) : 0;
  const durCnt = Number(sRow?.durCnt ?? 0n);
  const avgSessionMinutes =
    durCnt > 0 && sRow?.durSum != null
      ? Math.round(Number(sRow.durSum) / durCnt / 60)
      : 0;

  // Build daily series filling zero days.
  const dailySeries: { date: string; revenue: number }[] = [];
  for (let d = new Date(from); d < to; d = addDays(d, 1)) {
    const key = d.toISOString().slice(0, 10);
    dailySeries.push({ date: key, revenue: dailyMap.get(key) ?? 0 });
  }

  return NextResponse.json({
    range: r,
    from: from.toISOString(),
    to: to.toISOString(),
    timezone: tz,
    revenue,
    discountTotal,
    netRevenue,
    units,
    sessionsCompleted,
    aov,
    avgSessionMinutes,
    dailySeries,
    hourly,
    dow,
    topItems,
    slowItems,
  });
}
