import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { canAddStaff, planOf } from "@/lib/plans";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["ADMIN", "WAITER", "KITCHEN"]),
  password: z.string().min(6),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const list = await prisma.staff.findMany({
    where: { restaurantId: staff.restaurantId },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ staff: list });
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

  const exists = await prisma.staff.findUnique({ where: { email: parsed.data.email } });
  if (exists) return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 400 });

  const restaurant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: staff.restaurantId },
    select: { planTier: true },
  });
  const nonAdminCount = await prisma.staff.count({
    where: {
      restaurantId: staff.restaurantId,
      role: { in: ["WAITER", "KITCHEN"] },
    },
  });
  if (!canAddStaff(nonAdminCount, restaurant.planTier, parsed.data.role)) {
    const plan = planOf(restaurant.planTier);
    return NextResponse.json(
      {
        error: "PLAN_LIMIT",
        message: `Gói ${plan.label} giới hạn ${plan.limits.maxNonAdminStaff} nhân viên (phục vụ + bếp). Nâng cấp để thêm người.`,
      },
      { status: 402 },
    );
  }

  const created = await prisma.staff.create({
    data: {
      restaurantId: staff.restaurantId,
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role,
      passwordHash: await bcrypt.hash(parsed.data.password, 10),
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  return NextResponse.json({ staff: created });
}
