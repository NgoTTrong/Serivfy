import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  kind: z.enum(["RECEIPT", "KITCHEN", "BAR", "LABEL"]).optional(),
  paperWidth: z.union([z.literal(58), z.literal(80)]).optional(),
  isActive: z.boolean().optional(),
  usbVendorId: z.number().int().nullable().optional(),
  usbProductId: z.number().int().nullable().optional(),
  networkHost: z.string().max(60).nullable().optional(),
  networkPort: z.number().int().min(1).max(65535).nullable().optional(),
  bluetoothAddr: z.string().max(60).nullable().optional(),
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

  const printer = await prisma.printer.findUnique({ where: { id: params.id } });
  if (!printer || printer.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const upd = await prisma.printer.update({
    where: { id: printer.id },
    data: parsed.data,
  });
  return NextResponse.json({ printer: upd });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const printer = await prisma.printer.findUnique({ where: { id: params.id } });
  if (!printer || printer.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.printer.delete({ where: { id: printer.id } });
  return NextResponse.json({ ok: true });
}
