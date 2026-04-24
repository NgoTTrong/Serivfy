import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { tenantAudit } from "@/lib/tenant-audit";
import { planOf } from "@/lib/plans";

const schema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().max(300).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  timezone: z.string().max(60).optional().nullable(),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN", "WAITER"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const branches = await prisma.branch.findMany({
    where: { restaurantId: staff.restaurantId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { tables: true, staff: true } },
    },
  });
  return NextResponse.json({ branches });
}

export async function POST(req: NextRequest) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  // Plan gate: multi-branch is an Enterprise feature. Allow creating the
  // first branch on any plan (needed for the auto-created default), but
  // block additional branches on non-Enterprise tiers.
  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: staff.restaurantId },
    select: { planTier: true },
  });
  const plan = planOf(restaurant.planTier);
  if (!plan.limits.features.multiBranch) {
    const count = await prisma.branch.count({ where: { restaurantId: staff.restaurantId } });
    if (count >= 1) {
      return NextResponse.json(
        {
          error: "PLAN_LIMIT",
          message: `Gói ${plan.label} chỉ hỗ trợ 1 chi nhánh. Nâng cấp Enterprise để thêm chi nhánh.`,
        },
        { status: 402 },
      );
    }
  }

  const branch = await prisma.branch.create({
    data: {
      restaurantId: staff.restaurantId,
      name: parsed.data.name.trim(),
      address: parsed.data.address ?? null,
      phone: parsed.data.phone ?? null,
      timezone: parsed.data.timezone ?? null,
    },
  });
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "branch.created",
    target: branch.id,
    meta: { name: branch.name },
  });
  return NextResponse.json({ branch });
}
