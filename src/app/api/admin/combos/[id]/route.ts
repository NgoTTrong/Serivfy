import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { bumpPulse } from "@/lib/pulse";
import { tenantAudit } from "@/lib/tenant-audit";

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
  price: z.number().int().min(0).optional(),
  image: z.string().max(500).nullable().optional(),
  isAvailable: z.boolean().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string(),
        quantity: z.number().int().min(1).max(20),
        note: z.string().max(200).nullable().optional(),
      }),
    )
    .min(1)
    .optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const combo = await prisma.menuCombo.findUnique({ where: { id: params.id } });
  if (!combo || combo.restaurantId !== staff.restaurantId || combo.deletedAt) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (parsed.data.items) {
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
  }
  const upd = await prisma.$transaction(async (tx) => {
    const next = await tx.menuCombo.update({
      where: { id: combo.id },
      data: {
        name: parsed.data.name?.trim(),
        description: parsed.data.description,
        price: parsed.data.price,
        image: parsed.data.image,
        isAvailable: parsed.data.isAvailable,
      },
    });
    if (parsed.data.items) {
      await tx.menuComboItem.deleteMany({ where: { comboId: combo.id } });
      for (let i = 0; i < parsed.data.items.length; i++) {
        const it = parsed.data.items[i];
        await tx.menuComboItem.create({
          data: {
            comboId: combo.id,
            menuItemId: it.menuItemId,
            quantity: it.quantity,
            note: it.note ?? null,
            order: i,
          },
        });
      }
    }
    return next;
  });
  await bumpPulse(staff.restaurantId, "menu");
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "combo.updated",
    target: combo.id,
  });
  return NextResponse.json({ combo: upd });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const combo = await prisma.menuCombo.findUnique({ where: { id: params.id } });
  if (!combo || combo.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.menuCombo.update({
    where: { id: combo.id },
    data: { deletedAt: new Date(), isAvailable: false },
  });
  await bumpPulse(staff.restaurantId, "menu");
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "combo.deleted",
    target: combo.id,
    meta: { name: combo.name },
  });
  return NextResponse.json({ ok: true });
}
