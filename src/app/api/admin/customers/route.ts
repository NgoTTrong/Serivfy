import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { computeBadge } from "@/lib/memory";

export async function GET(req: NextRequest) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const segment = req.nextUrl.searchParams.get("segment") ?? "ALL";
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase();

  const now = Date.now();
  const DAY = 86_400_000;

  let where: Record<string, unknown> = { restaurantId: staff.restaurantId };
  switch (segment) {
    case "VIP":
      where = { ...where, visitCount: { gte: 20 } };
      break;
    case "LOYAL":
      where = { ...where, visitCount: { gte: 10, lt: 20 } };
      break;
    case "REGULAR":
      where = { ...where, visitCount: { gte: 3, lt: 10 } };
      break;
    case "RETURNING":
      where = { ...where, visitCount: { gte: 2, lt: 3 } };
      break;
    case "NEW":
      where = { ...where, visitCount: { lt: 2 } };
      break;
    case "AT_RISK":
      where = {
        ...where,
        visitCount: { gte: 3 },
        lastVisit: { lt: new Date(now - 60 * DAY) },
      };
      break;
    case "THIS_WEEK":
      where = { ...where, lastVisit: { gte: new Date(now - 7 * DAY) } };
      break;
  }
  if (q) {
    where = { ...where, OR: [{ nickname: { contains: q } }, { deviceId: { contains: q } }] };
  }

  const devices = await prisma.customerDevice.findMany({
    where,
    orderBy: [{ visitCount: "desc" }, { totalSpent: "desc" }],
    take: 500,
    select: {
      id: true,
      deviceId: true,
      nickname: true,
      visitCount: true,
      totalSpent: true,
      firstVisit: true,
      lastVisit: true,
      favoriteJson: true,
    },
  });

  // Enrich each with badge + favorite item names
  const allFavIds = new Set<string>();
  const parsed = devices.map((d) => {
    let top: string[] = [];
    try {
      const obj = d.favoriteJson ? (JSON.parse(d.favoriteJson) as Record<string, number>) : {};
      top = Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id]) => id);
    } catch {
      /* ignore malformed */
    }
    top.forEach((id) => allFavIds.add(id));
    return { device: d, top };
  });

  const favItems = allFavIds.size
    ? await prisma.menuItem.findMany({
        where: { id: { in: Array.from(allFavIds) }, deletedAt: null },
        select: { id: true, name: true },
      })
    : [];
  const favMap = new Map(favItems.map((m) => [m.id, m.name]));

  // Summary counts
  const totalAll = await prisma.customerDevice.count({
    where: { restaurantId: staff.restaurantId },
  });
  const vipCount = await prisma.customerDevice.count({
    where: { restaurantId: staff.restaurantId, visitCount: { gte: 20 } },
  });
  const loyalCount = await prisma.customerDevice.count({
    where: { restaurantId: staff.restaurantId, visitCount: { gte: 10, lt: 20 } },
  });
  const regularCount = await prisma.customerDevice.count({
    where: { restaurantId: staff.restaurantId, visitCount: { gte: 3, lt: 10 } },
  });
  const atRiskCount = await prisma.customerDevice.count({
    where: {
      restaurantId: staff.restaurantId,
      visitCount: { gte: 3 },
      lastVisit: { lt: new Date(now - 60 * DAY) },
    },
  });

  const customers = parsed.map(({ device, top }) => ({
    id: device.id,
    nickname: device.nickname,
    deviceAlias: device.deviceId.slice(-6).toUpperCase(),
    visitCount: device.visitCount,
    totalSpent: device.totalSpent,
    firstVisit: device.firstVisit,
    lastVisit: device.lastVisit,
    badge: computeBadge(device.visitCount),
    topItems: top.map((id) => favMap.get(id)).filter(Boolean),
  }));

  return NextResponse.json({
    customers,
    summary: {
      total: totalAll,
      vip: vipCount,
      loyal: loyalCount,
      regular: regularCount,
      atRisk: atRiskCount,
    },
  });
}
