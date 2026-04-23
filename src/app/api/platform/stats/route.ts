import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platform-auth";

export async function GET() {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    totalRestaurants,
    active,
    suspended,
    expired,
    trial,
    pending,
    paidTierCounts,
    revenueTodayAgg,
    newRestaurantsTodayCount,
  ] = await Promise.all([
    prisma.restaurant.count(),
    prisma.restaurant.count({ where: { status: "ACTIVE" } }),
    prisma.restaurant.count({ where: { status: "SUSPENDED" } }),
    prisma.restaurant.count({ where: { status: "EXPIRED" } }),
    prisma.restaurant.count({ where: { planTier: "TRIAL", status: "ACTIVE" } }),
    prisma.signupRequest.count({ where: { status: "PENDING" } }),
    prisma.restaurant.groupBy({
      by: ["planTier"],
      _count: { _all: true },
    }),
    prisma.tableSession.aggregate({
      _sum: { paidAmount: true },
      where: { paidAt: { gte: startOfToday } },
    }),
    prisma.restaurant.count({ where: { approvedAt: { gte: startOfToday } } }),
  ]);

  return NextResponse.json({
    totalRestaurants,
    active,
    suspended,
    expired,
    trial,
    pending,
    paidTierCounts: paidTierCounts.map((p) => ({
      tier: p.planTier,
      count: p._count._all,
    })),
    revenueTodayVND: revenueTodayAgg._sum.paidAmount ?? 0,
    newRestaurantsToday: newRestaurantsTodayCount,
  });
}
