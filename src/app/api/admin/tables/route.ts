import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { canAddTable, planOf } from "@/lib/plans";

const schema = z.object({
  number: z.number().int().min(1),
  label: z.string().min(1),
  capacity: z.number().int().min(1).max(50),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const tables = await prisma.table.findMany({
    where: { restaurantId: staff.restaurantId },
    orderBy: { number: "asc" },
  });
  return NextResponse.json({ tables });
}

export async function POST(req: NextRequest) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: staff.restaurantId },
    select: { planTier: true },
  });
  const currentCount = await prisma.table.count({
    where: { restaurantId: staff.restaurantId },
  });
  if (!canAddTable(currentCount, restaurant.planTier)) {
    const plan = planOf(restaurant.planTier);
    return NextResponse.json(
      {
        error: "PLAN_LIMIT",
        message: `Gói ${plan.label} giới hạn ${plan.limits.maxTables} bàn. Nâng cấp để thêm bàn.`,
      },
      { status: 402 },
    );
  }

  const t = await prisma.table.create({
    data: { ...parsed.data, restaurantId: staff.restaurantId },
  });
  return NextResponse.json({ table: t });
}
