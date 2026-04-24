import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPlatformSession, audit } from "@/lib/platform-auth";

const schema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "EXPIRED"]).optional(),
  planTier: z.enum(["TRIAL", "STARTER", "PRO", "ENTERPRISE"]).optional(),
  suspendReason: z.string().max(500).nullable().optional(),
  extendTrialDays: z.number().int().min(1).max(365).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const r = await prisma.restaurant.findUnique({
    where: { id: params.id },
    include: {
      staff: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
      _count: {
        select: {
          tables: true,
          menuItems: true,
          sessions: true,
          categories: true,
        },
      },
    },
  });
  if (!r) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Today's revenue for this restaurant
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const revenue = await prisma.tableSession.aggregate({
    where: { restaurantId: r.id, paidAt: { gte: startOfToday } },
    _sum: { paidAmount: true },
  });
  const lifetimeRevenue = await prisma.tableSession.aggregate({
    where: { restaurantId: r.id, paidAt: { not: null } },
    _sum: { paidAmount: true },
  });

  return NextResponse.json({
    restaurant: r,
    revenueTodayVND: revenue._sum.paidAmount ?? 0,
    lifetimeRevenueVND: lifetimeRevenue._sum.paidAmount ?? 0,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const existing = await prisma.restaurant.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const data: Record<string, unknown> = {};
  // Bump tokenVersion whenever the restaurant transitions into a non-usable state
  // so all in-flight staff JWTs are invalidated within the auth cache TTL.
  let bumpTokenVersion = false;
  if (parsed.data.status) {
    data.status = parsed.data.status;
    if (parsed.data.status === "SUSPENDED") {
      data.suspendedAt = new Date();
      data.suspendReason = parsed.data.suspendReason ?? "Đình chỉ bởi quản trị";
      if (existing.status !== "SUSPENDED") bumpTokenVersion = true;
    } else {
      data.suspendedAt = null;
      data.suspendReason = null;
    }
    if (parsed.data.status === "EXPIRED" && existing.status !== "EXPIRED") {
      bumpTokenVersion = true;
    }
  }
  if (parsed.data.planTier) {
    data.planTier = parsed.data.planTier;
    if (parsed.data.planTier !== "TRIAL") data.trialEndsAt = null;
  }
  if (parsed.data.extendTrialDays) {
    const base = existing.trialEndsAt && existing.trialEndsAt > new Date()
      ? existing.trialEndsAt
      : new Date();
    const next = new Date(base.getTime() + parsed.data.extendTrialDays * 24 * 3600 * 1000);
    data.trialEndsAt = next;
    data.planTier = "TRIAL";
    if (existing.status === "EXPIRED") data.status = "ACTIVE";
  }

  const updated = await prisma.restaurant.update({
    where: { id: params.id },
    data: bumpTokenVersion
      ? { ...data, tokenVersion: { increment: 1 } }
      : data,
  });
  audit({ id: s.sub, name: s.name }, "RESTAURANT_UPDATED", params.id, parsed.data);
  return NextResponse.json({ restaurant: updated });
}
