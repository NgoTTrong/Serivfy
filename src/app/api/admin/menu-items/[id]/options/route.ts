import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { bumpPulse } from "@/lib/pulse";

const schema = z.object({
  groups: z.array(
    z.object({
      name: z.string().min(1).max(60),
      required: z.boolean().default(false),
      multiple: z.boolean().default(false),
      choices: z.array(
        z.object({
          label: z.string().min(1).max(60),
          priceDelta: z.number().int().min(-1_000_000).max(10_000_000),
        }),
      ).min(1),
    }),
  ),
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
      optionGroups: {
        orderBy: { order: "asc" },
        include: { choices: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!item || item.restaurantId !== staff.restaurantId || item.deletedAt) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ groups: item.optionGroups });
}

/**
 * Replace the full option-group config for a menu item.
 * Keeps existing order history untouched — only current/future cart + order
 * snapshots reflect new options via `optionsLabel` / `optionsPrice` fields.
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

  await prisma.$transaction(async (tx) => {
    await tx.menuOptionGroup.deleteMany({ where: { menuItemId: item.id } });
    for (let gi = 0; gi < parsed.data.groups.length; gi++) {
      const g = parsed.data.groups[gi];
      await tx.menuOptionGroup.create({
        data: {
          menuItemId: item.id,
          name: g.name,
          required: g.required,
          multiple: g.multiple,
          order: gi,
          choices: {
            create: g.choices.map((c, ci) => ({
              label: c.label,
              priceDelta: c.priceDelta,
              order: ci,
            })),
          },
        },
      });
    }
  });

  await bumpPulse(staff.restaurantId, "menu");
  return NextResponse.json({ ok: true });
}
