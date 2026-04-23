import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { planOf } from "@/lib/plans";

type Range = "TODAY" | "WEEK" | "MONTH" | "CUSTOM";

function rangeToDates(range: Range, fromStr?: string | null, toStr?: string | null) {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case "TODAY":
      return { from: startOfToday, to: endOfToday };
    case "WEEK": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 6);
      return { from, to: endOfToday };
    }
    case "MONTH": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 29);
      return { from, to: endOfToday };
    }
    case "CUSTOM": {
      const from = fromStr ? new Date(fromStr) : startOfToday;
      const to = toStr ? new Date(toStr) : endOfToday;
      return { from, to };
    }
  }
}

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
    select: { planTier: true },
  });
  const plan = planOf(restaurant.planTier);

  // Gate: advanced range only for PRO+/Enterprise
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

  const { from, to } = rangeToDates(r, fromQ, toQ);

  // Fetch all OrderItems in range for this restaurant
  const items = await prisma.orderItem.findMany({
    where: {
      round: { session: { restaurantId: staff.restaurantId } },
      createdAt: { gte: from, lt: to },
    },
    select: {
      id: true,
      menuItemId: true,
      quantity: true,
      priceAtOrder: true,
      createdAt: true,
      menuItem: { select: { name: true, image: true } },
    },
  });

  // Fetch closed sessions for AOV
  const closedSessions = await prisma.tableSession.findMany({
    where: {
      restaurantId: staff.restaurantId,
      paidAt: { gte: from, lt: to, not: null },
    },
    select: { id: true, paidAmount: true, paidAt: true, openedAt: true, closedAt: true },
  });

  let revenue = 0;
  let units = 0;
  const daily = new Map<string, number>(); // YYYY-MM-DD → revenue
  const hourly: number[] = Array.from({ length: 24 }, () => 0);
  const dow: number[] = Array.from({ length: 7 }, () => 0); // 0=Sun
  const byItem = new Map<
    string,
    { name: string; qty: number; revenue: number; image: string | null }
  >();

  for (const it of items) {
    const sub = it.priceAtOrder * it.quantity;
    revenue += sub;
    units += it.quantity;
    const d = new Date(it.createdAt);
    const dayKey = d.toISOString().slice(0, 10);
    daily.set(dayKey, (daily.get(dayKey) ?? 0) + sub);
    hourly[d.getHours()] += sub;
    dow[d.getDay()] += sub;
    const b = byItem.get(it.menuItemId) ?? {
      name: it.menuItem.name,
      qty: 0,
      revenue: 0,
      image: it.menuItem.image,
    };
    b.qty += it.quantity;
    b.revenue += sub;
    byItem.set(it.menuItemId, b);
  }

  const topItems = Array.from(byItem.entries())
    .map(([id, v]) => ({ menuItemId: id, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const slowItems = Array.from(byItem.entries())
    .map(([id, v]) => ({ menuItemId: id, ...v }))
    .sort((a, b) => a.qty - b.qty)
    .slice(0, 10);

  const paidRevenue = closedSessions.reduce((s, c) => s + (c.paidAmount ?? 0), 0);
  const aov = closedSessions.length > 0 ? Math.round(paidRevenue / closedSessions.length) : 0;

  // Avg session duration in minutes
  let durationSum = 0;
  let durationCount = 0;
  for (const c of closedSessions) {
    if (c.openedAt && c.closedAt) {
      durationSum += (c.closedAt.getTime() - c.openedAt.getTime()) / 60000;
      durationCount += 1;
    }
  }
  const avgSessionMinutes = durationCount > 0 ? Math.round(durationSum / durationCount) : 0;

  // Daily series (fill zeros for missing days)
  const dailySeries: { date: string; revenue: number }[] = [];
  const cursor = new Date(from);
  while (cursor < to) {
    const key = cursor.toISOString().slice(0, 10);
    dailySeries.push({ date: key, revenue: daily.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return NextResponse.json({
    range: r,
    from: from.toISOString(),
    to: to.toISOString(),
    revenue,
    units,
    sessionsCompleted: closedSessions.length,
    aov,
    avgSessionMinutes,
    dailySeries,
    hourly,
    dow,
    topItems,
    slowItems,
  });
}
