import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  price: z.number().int().min(0).optional(),
  categoryId: z.string().optional(),
  image: z.string().nullable().optional(),
  isAvailable: z.boolean().optional(),
  order: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const item = await prisma.menuItem.findUnique({ where: { id: params.id } });
  if (!item || item.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const upd = await prisma.menuItem.update({ where: { id: item.id }, data: parsed.data });
  return NextResponse.json({ item: upd });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const item = await prisma.menuItem.findUnique({ where: { id: params.id } });
  if (!item || item.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.menuItem.delete({ where: { id: item.id } });
  return NextResponse.json({ ok: true });
}
