import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { tenantAudit } from "@/lib/tenant-audit";
import { bumpPulse } from "@/lib/pulse";

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  price: z.number().int().min(0),
  image: z.string().max(500).optional().nullable(),
  isAvailable: z.boolean().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1).max(20),
        note: z.string().max(200).optional().nullable(),
      }),
    )
    .min(1),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const combos = await prisma.menuCombo.findMany({
    where: { restaurantId: staff.restaurantId, deletedAt: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      items: {
        orderBy: { order: "asc" },
        include: { menuItem: { select: { id: true, name: true, price: true } } },
      },
    },
  });
  return NextResponse.json({ combos });
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

  // Verify all constituent items belong to this tenant to prevent cross-tenant leakage.
  const valid = await prisma.menuItem.findMany({
    where: {
      id: { in: parsed.data.items.map((i) => i.menuItemId) },
      restaurantId: staff.restaurantId,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (valid.length !== parsed.data.items.length) {
    return NextResponse.json({ error: "BAD_ITEM" }, { status: 400 });
  }

  const combo = await prisma.menuCombo.create({
    data: {
      restaurantId: staff.restaurantId,
      name: parsed.data.name.trim(),
      description: parsed.data.description ?? null,
      price: parsed.data.price,
      image: parsed.data.image ?? null,
      isAvailable: parsed.data.isAvailable ?? true,
      items: {
        create: parsed.data.items.map((it, i) => ({
          menuItemId: it.menuItemId,
          quantity: it.quantity,
          note: it.note ?? null,
          order: i,
        })),
      },
    },
    include: { items: true },
  });
  await bumpPulse(staff.restaurantId, "menu");
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "combo.created",
    target: combo.id,
    meta: { name: combo.name, price: combo.price, count: combo.items.length },
  });
  return NextResponse.json({ combo });
}
