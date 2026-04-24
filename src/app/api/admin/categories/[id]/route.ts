import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { bumpPulse } from "@/lib/pulse";

const schema = z.object({
  name: z.string().min(1).optional(),
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
  const c = await prisma.category.findUnique({ where: { id: params.id } });
  if (!c || c.restaurantId !== staff.restaurantId || c.deletedAt) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const upd = await prisma.category.update({ where: { id: c.id }, data: parsed.data });
  await bumpPulse(staff.restaurantId, "menu");
  return NextResponse.json({ category: upd });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const c = await prisma.category.findUnique({
    where: { id: params.id },
    include: { menuItems: { where: { deletedAt: null } } },
  });
  if (!c || c.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (c.deletedAt) return NextResponse.json({ ok: true });
  if (c.menuItems.length > 0) {
    return NextResponse.json({ error: "HAS_ITEMS" }, { status: 400 });
  }
  await prisma.category.update({
    where: { id: c.id },
    data: { deletedAt: new Date() },
  });
  await bumpPulse(staff.restaurantId, "menu");
  return NextResponse.json({ ok: true });
}
