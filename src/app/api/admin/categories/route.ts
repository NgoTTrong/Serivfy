import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1),
  order: z.number().int().optional(),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const cats = await prisma.category.findMany({
    where: { restaurantId: staff.restaurantId },
    orderBy: { order: "asc" },
  });
  return NextResponse.json({ categories: cats });
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

  const c = await prisma.category.create({
    data: { ...parsed.data, restaurantId: staff.restaurantId },
  });
  return NextResponse.json({ category: c });
}
