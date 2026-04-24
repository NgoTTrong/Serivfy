import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { tenantAudit } from "@/lib/tenant-audit";

const schema = z.object({
  name: z.string().min(1).max(80),
  required: z.boolean().default(false),
  multiple: z.boolean().default(false),
  order: z.number().int().optional(),
  choices: z
    .array(
      z.object({
        label: z.string().min(1).max(80),
        priceDelta: z.number().int().min(-1_000_000).max(10_000_000),
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
  const templates = await prisma.modifierTemplate.findMany({
    where: { restaurantId: staff.restaurantId, deletedAt: null },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      choices: { orderBy: { order: "asc" } },
      _count: { select: { appliedTo: true } },
    },
  });
  return NextResponse.json({ templates });
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

  const template = await prisma.modifierTemplate.create({
    data: {
      restaurantId: staff.restaurantId,
      name: parsed.data.name.trim(),
      required: parsed.data.required,
      multiple: parsed.data.multiple,
      order: parsed.data.order ?? 0,
      choices: {
        create: parsed.data.choices.map((c, i) => ({
          label: c.label.trim(),
          priceDelta: c.priceDelta,
          order: i,
        })),
      },
    },
    include: { choices: true },
  });
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "modifier.created",
    target: template.id,
    meta: { name: template.name, choices: parsed.data.choices.length },
  });
  return NextResponse.json({ template });
}
