import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  order: z.number().int().optional(),
  printerId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const station = await prisma.station.findUnique({ where: { id: params.id } });
  if (!station || station.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  if (parsed.data.printerId !== undefined && parsed.data.printerId !== null) {
    const printer = await prisma.printer.findUnique({
      where: { id: parsed.data.printerId },
      select: { restaurantId: true },
    });
    if (!printer || printer.restaurantId !== staff.restaurantId) {
      return NextResponse.json({ error: "BAD_PRINTER" }, { status: 400 });
    }
  }

  const upd = await prisma.station.update({
    where: { id: station.id },
    data: parsed.data,
  });
  return NextResponse.json({ station: upd });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const station = await prisma.station.findUnique({
    where: { id: params.id },
    include: { _count: { select: { menuItems: true } } },
  });
  if (!station || station.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  // Deletion sets MenuItem.stationId to null via FK ON DELETE SET NULL, so
  // the menu survives — it just stops printing until a new station is
  // assigned. Surface the count so the admin UI can warn before confirming.
  await prisma.station.delete({ where: { id: station.id } });
  return NextResponse.json({ ok: true, detachedItems: station._count.menuItems });
}
