import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { bumpPulse } from "@/lib/pulse";
import { tenantAudit } from "@/lib/tenant-audit";

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().int().min(0),
  categoryId: z.string(),
  image: z.string().optional(),
  isAvailable: z.boolean().optional(),
  order: z.number().int().optional(),
  stationId: z.string().nullable().optional(),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const items = await prisma.menuItem.findMany({
    where: { restaurantId: staff.restaurantId, deletedAt: null },
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
  if (!cat || cat.restaurantId !== staff.restaurantId || cat.deletedAt) {
    return NextResponse.json({ error: "BAD_CATEGORY" }, { status: 400 });
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

  const item = await prisma.menuItem.create({
    data: { ...parsed.data, restaurantId: staff.restaurantId },
  });
  await bumpPulse(staff.restaurantId, "menu");
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "menu.item.created",
    target: item.id,
    meta: { name: item.name, price: item.price },
  });
  return NextResponse.json({ item });
}
