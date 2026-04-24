import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { bumpPulse } from "@/lib/pulse";
import { tenantAudit } from "@/lib/tenant-audit";

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  price: z.number().int().min(0).optional(),
  categoryId: z.string().optional(),
  image: z.string().nullable().optional(),
  isAvailable: z.boolean().optional(),
  order: z.number().int().optional(),
  stationId: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const item = await prisma.menuItem.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      station: { select: { id: true, name: true } },
      optionGroups: {
        orderBy: { order: "asc" },
        include: { choices: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!item || item.restaurantId !== staff.restaurantId || item.deletedAt) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ item });
}

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
  if (!item || item.restaurantId !== staff.restaurantId || item.deletedAt) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (parsed.data.stationId) {
    const station = await prisma.station.findUnique({
      where: { id: parsed.data.stationId },
      select: { restaurantId: true },
    });
    if (!station || station.restaurantId !== staff.restaurantId) {
      return NextResponse.json({ error: "BAD_STATION" }, { status: 400 });
    }
  }
  const upd = await prisma.menuItem.update({ where: { id: item.id }, data: parsed.data });
  await bumpPulse(staff.restaurantId, "menu");
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "menu.item.updated",
    target: item.id,
    meta: { before: item, after: parsed.data },
  });
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
  if (item.deletedAt) return NextResponse.json({ ok: true });
  // Soft delete: keep the row so historical OrderItems referring to this
  // MenuItem via FK can still resolve name/price in past receipts/analytics.
  // Also hide from menu by flipping isAvailable so any cached menu fragment
  // can't accidentally let a customer add it.
  await prisma.menuItem.update({
    where: { id: item.id },
    data: { deletedAt: new Date(), isAvailable: false },
  });
  await bumpPulse(staff.restaurantId, "menu");
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "menu.item.deleted",
    target: item.id,
    meta: { name: item.name, price: item.price },
  });
  return NextResponse.json({ ok: true });
}
