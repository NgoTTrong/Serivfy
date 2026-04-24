import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { tenantAudit } from "@/lib/tenant-audit";

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  required: z.boolean().optional(),
  multiple: z.boolean().optional(),
  order: z.number().int().optional(),
  choices: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        priceDelta: z.number().int().min(-1_000_000).max(10_000_000),
      }),
    )
    .min(1)
    .optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const template = await prisma.modifierTemplate.findUnique({
    where: { id: params.id },
    include: {
      choices: { orderBy: { order: "asc" } },
      _count: { select: { appliedTo: true } },
    },
  });
  if (!template || template.restaurantId !== staff.restaurantId || template.deletedAt) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

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

  const template = await prisma.modifierTemplate.findUnique({ where: { id: params.id } });
  if (!template || template.restaurantId !== staff.restaurantId || template.deletedAt) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Replace choices if provided. Kept inside a tx so partial writes can't
  // leave a template with zero options while the old rows are gone.
  const upd = await prisma.$transaction(async (tx) => {
    const next = await tx.modifierTemplate.update({
      where: { id: template.id },
      data: {
        name: parsed.data.name?.trim(),
        required: parsed.data.required,
        multiple: parsed.data.multiple,
        order: parsed.data.order,
      },
    });
    if (parsed.data.choices) {
      await tx.modifierTemplateChoice.deleteMany({ where: { templateId: template.id } });
      for (let i = 0; i < parsed.data.choices.length; i++) {
        const c = parsed.data.choices[i];
        await tx.modifierTemplateChoice.create({
          data: {
            templateId: template.id,
            label: c.label.trim(),
            priceDelta: c.priceDelta,
            order: i,
          },
        });
      }
    }
    return next;
  });

  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "modifier.updated",
    target: upd.id,
    meta: { choiceChanged: !!parsed.data.choices },
  });
  return NextResponse.json({ template: upd });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const template = await prisma.modifierTemplate.findUnique({
    where: { id: params.id },
    include: { _count: { select: { appliedTo: true } } },
  });
  if (!template || template.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  // Soft-delete so historical orders + attached menu items keep resolving
  // even if the admin rotates their modifier library.
  await prisma.modifierTemplate.update({
    where: { id: template.id },
    data: { deletedAt: new Date() },
  });
  await prisma.menuItemModifier.deleteMany({ where: { templateId: template.id } });
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "modifier.deleted",
    target: template.id,
    meta: { name: template.name, detachedFrom: template._count.appliedTo },
  });
  return NextResponse.json({ ok: true });
}
