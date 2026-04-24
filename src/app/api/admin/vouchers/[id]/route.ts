import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const patchSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  value: z.number().int().min(1).optional(),
  minOrderVND: z.number().int().min(0).nullable().optional(),
  maxDiscountVND: z.number().int().min(0).nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  totalLimit: z.number().int().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
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

  const voucher = await prisma.voucher.findUnique({ where: { id: params.id } });
  if (!voucher || voucher.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const d = parsed.data;
  const upd = await prisma.voucher.update({
    where: { id: voucher.id },
    data: {
      label: d.label,
      value: d.value,
      minOrderVND: d.minOrderVND,
      maxDiscountVND: d.maxDiscountVND,
      startAt: d.startAt !== undefined ? (d.startAt ? new Date(d.startAt) : null) : undefined,
      endAt: d.endAt !== undefined ? (d.endAt ? new Date(d.endAt) : null) : undefined,
      totalLimit: d.totalLimit,
      isActive: d.isActive,
    },
  });
  return NextResponse.json({ voucher: upd });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const voucher = await prisma.voucher.findUnique({
    where: { id: params.id },
    include: { _count: { select: { redemptions: true } } },
  });
  if (!voucher || voucher.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  // If redemptions exist we can't hard-delete (FK restrict). Soft-disable.
  if (voucher._count.redemptions > 0) {
    const upd = await prisma.voucher.update({
      where: { id: voucher.id },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true, disabled: true, voucher: upd });
  }
  await prisma.voucher.delete({ where: { id: voucher.id } });
  return NextResponse.json({ ok: true });
}
