import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { bumpPulse } from "@/lib/pulse";

const schema = z.object({
  templateIds: z.array(z.string()).max(20),
});

/**
 * Replace the set of modifier templates attached to a menu item. Order in
 * the array becomes display order on the customer side.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const item = await prisma.menuItem.findUnique({ where: { id: params.id } });
  if (!item || item.restaurantId !== staff.restaurantId || item.deletedAt) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  // Verify all templates belong to the same tenant. One bad id aborts the
  // whole call so we don't half-write.
  if (parsed.data.templateIds.length > 0) {
    const valid = await prisma.modifierTemplate.findMany({
      where: {
        id: { in: parsed.data.templateIds },
        restaurantId: staff.restaurantId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (valid.length !== parsed.data.templateIds.length) {
      return NextResponse.json({ error: "BAD_TEMPLATE_ID" }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.menuItemModifier.deleteMany({ where: { menuItemId: item.id } });
    for (let i = 0; i < parsed.data.templateIds.length; i++) {
      await tx.menuItemModifier.create({
        data: {
          menuItemId: item.id,
          templateId: parsed.data.templateIds[i],
          order: i,
        },
      });
    }
  });
  await bumpPulse(staff.restaurantId, "menu");
  return NextResponse.json({ ok: true });
}
