import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().min(0),
  categoryId: z.string(),
  image: z.string().optional(),
  isAvailable: z.boolean().optional(),
  order: z.number().int().optional(),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const items = await prisma.menuItem.findMany({
    where: { restaurantId: staff.restaurantId },
    include: { category: true },
    orderBy: [{ category: { order: "asc" } }, { order: "asc" }],
  });
  return NextResponse.json({ items });
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

  const cat = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
  if (!cat || cat.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "BAD_CATEGORY" }, { status: 400 });
  }

  const item = await prisma.menuItem.create({
    data: { ...parsed.data, restaurantId: staff.restaurantId },
  });
  return NextResponse.json({ item });
}
