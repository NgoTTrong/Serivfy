import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platform-auth";

export async function GET(req: NextRequest) {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const where: Record<string, unknown> = {};
  if (status && status !== "ALL") where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { slug: { contains: q } },
      { phone: { contains: q } },
    ];
  }

  const restaurants = await prisma.restaurant.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      phone: true,
      address: true,
      status: true,
      planTier: true,
      trialEndsAt: true,
      approvedAt: true,
      suspendedAt: true,
      createdAt: true,
      _count: { select: { tables: true, staff: true, menuItems: true, sessions: true } },
    },
  });
  return NextResponse.json({ restaurants });
}
