import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { computeSessionGross, validateVoucher } from "@/lib/voucher";
import { bumpPulse } from "@/lib/pulse";

const applySchema = z.object({
  code: z.string().min(1).max(30),
});

/**
 * Apply a voucher to this session. Staff-only to prevent customers from
 * brute-forcing codes from the customer app. One voucher per session
 * (enforced by the sessionId unique index on VoucherRedemption).
 *
 * We validate-and-insert in a single transaction guarded by the unique
 * index so two concurrent applies can't both win.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN", "WAITER"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { id: true, status: true, restaurantId: true },
  });
  if (!session || session.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "SESSION_CLOSED" }, { status: 410 });
  }

  const gross = await computeSessionGross(session.id);
  const validation = await validateVoucher({
    restaurantId: session.restaurantId,
    code: parsed.data.code,
    gross,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error, message: validation.message },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Replace any previously-applied voucher for this session.
      await tx.voucherRedemption.deleteMany({ where: { sessionId: session.id } });
      await tx.voucherRedemption.create({
        data: {
          voucherId: validation.voucher.id,
          restaurantId: session.restaurantId,
          sessionId: session.id,
          voucherCode: validation.voucher.code,
          voucherLabel: validation.voucher.label,
          discountAmt: validation.discount,
        },
      });
      await tx.tableSession.update({
        where: { id: session.id },
        data: {
          discountAmount: validation.discount,
          voucherCode: validation.voucher.code,
          voucherLabel: validation.voucher.label,
        },
      });
    });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "ALREADY_APPLIED" }, { status: 409 });
    }
    throw e;
  }

  await bumpPulse(session.restaurantId, ["tables", "customer"]);
  return NextResponse.json({
    ok: true,
    discount: validation.discount,
    net: validation.net,
    code: validation.voucher.code,
    label: validation.voucher.label,
  });
}

/**
 * Preview voucher effect without persisting. Cheap; lets the cashier UI
 * show the discount live before the user commits.
 */
export async function PUT(req: NextRequest, { params }: { params: { token: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN", "WAITER"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { id: true, restaurantId: true },
  });
  if (!session || session.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const gross = await computeSessionGross(session.id);
  const validation = await validateVoucher({
    restaurantId: session.restaurantId,
    code: parsed.data.code,
    gross,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { ok: false, error: validation.error, message: validation.message },
      { status: 200 },
    );
  }
  return NextResponse.json({
    ok: true,
    discount: validation.discount,
    gross: validation.gross,
    net: validation.net,
    code: validation.voucher.code,
    label: validation.voucher.label,
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { token: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN", "WAITER"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { id: true, status: true, restaurantId: true },
  });
  if (!session || session.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "SESSION_CLOSED" }, { status: 410 });
  }
  await prisma.$transaction(async (tx) => {
    await tx.voucherRedemption.deleteMany({ where: { sessionId: session.id } });
    await tx.tableSession.update({
      where: { id: session.id },
      data: { discountAmount: 0, voucherCode: null, voucherLabel: null },
    });
  });
  await bumpPulse(session.restaurantId, ["tables", "customer"]);
  return NextResponse.json({ ok: true });
}
