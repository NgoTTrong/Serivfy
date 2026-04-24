import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { tenantAudit } from "@/lib/tenant-audit";

const schema = z.object({
  code: z.string().min(2).max(30).transform((s) => s.trim().toUpperCase()),
  label: z.string().min(1).max(120),
  kind: z.enum(["PERCENT_OFF", "FIXED_OFF"]),
  value: z.number().int().min(1),
  minOrderVND: z.number().int().min(0).nullable().optional(),
  maxDiscountVND: z.number().int().min(0).nullable().optional(),
  startAt: z.string().datetime().nullable().optional(),
  endAt: z.string().datetime().nullable().optional(),
  totalLimit: z.number().int().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const vouchers = await prisma.voucher.findMany({
    where: { restaurantId: staff.restaurantId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ vouchers });
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

  // PERCENT_OFF sanity: value must be between 1-100.
  if (parsed.data.kind === "PERCENT_OFF" && parsed.data.value > 100) {
    return NextResponse.json(
      { error: "BAD_INPUT", message: "Phần trăm phải từ 1 đến 100" },
      { status: 400 },
    );
  }

  try {
    const voucher = await prisma.voucher.create({
      data: {
        restaurantId: staff.restaurantId,
        code: parsed.data.code,
        label: parsed.data.label,
        kind: parsed.data.kind,
        value: parsed.data.value,
        minOrderVND: parsed.data.minOrderVND ?? null,
        maxDiscountVND: parsed.data.maxDiscountVND ?? null,
        startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : null,
        endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
        totalLimit: parsed.data.totalLimit ?? null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    tenantAudit({
      restaurantId: staff.restaurantId,
      actor: { id: staff.sub, name: staff.name },
      action: "voucher.created",
      target: voucher.id,
      meta: { code: voucher.code, kind: voucher.kind, value: voucher.value },
    });
    return NextResponse.json({ voucher });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "CODE_TAKEN" }, { status: 409 });
    }
    throw e;
  }
}
