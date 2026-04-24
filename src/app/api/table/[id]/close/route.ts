import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { settleSessionToMemory } from "@/lib/memory";
import { bumpPulse } from "@/lib/pulse";
import { enqueueReceipt } from "@/lib/print-dispatch";
import { recordSessionMovement } from "@/lib/shift";
import { issueEInvoiceForSession } from "@/lib/einvoice";

const schema = z
  .object({
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD"]).optional(),
    paidAmount: z.number().int().min(0).optional(),
  })
  .partial();

function makeReceiptNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  // Wider suffix (6 hex ≈ 16M combos per day) so collisions under the
  // partial unique index on (restaurantId, receiptNumber) are effectively
  // impossible even for high-volume tenants.
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SVF-${ymd}-${rand}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN", "WAITER"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  }

  const table = await prisma.table.findUnique({ where: { id: params.id } });
  if (!table || table.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const active = await prisma.tableSession.findFirst({
    where: { tableId: table.id, status: "ACTIVE" },
  });
  if (!active) return NextResponse.json({ error: "NO_ACTIVE_SESSION" }, { status: 400 });

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const sess = await tx.tableSession.update({
      where: { id: active.id },
      data: {
        status: "CLOSED",
        closedAt: now,
        billRequestedAt: null,
        paymentMethod: parsed.data.paymentMethod ?? null,
        paidAmount: parsed.data.paidAmount ?? null,
        paidAt: parsed.data.paymentMethod ? now : null,
        cashierStaffId: staff.sub,
        receiptNumber: active.receiptNumber ?? makeReceiptNumber(),
      },
      select: {
        id: true,
        closedAt: true,
        paymentMethod: true,
        paidAmount: true,
        paidAt: true,
        receiptNumber: true,
      },
    });
    // Commit any voucher redemption: bump the voucher's usageCount and
    // stamp committedAt. Done inside the same transaction so rolling back
    // the close also rolls back the voucher count.
    const redemption = await tx.voucherRedemption.findUnique({
      where: { sessionId: active.id },
    });
    if (redemption && !redemption.committedAt) {
      await tx.voucher.update({
        where: { id: redemption.voucherId },
        data: { usageCount: { increment: 1 } },
      });
      await tx.voucherRedemption.update({
        where: { id: redemption.id },
        data: { committedAt: now },
      });
    }
    return sess;
  });

  // Attribute spend + favorites to Servify Memory (non-blocking).
  try {
    await settleSessionToMemory(active.id);
  } catch {
    /* swallow */
  }

  await bumpPulse(staff.restaurantId, ["tables", "customer"]);
  // Fire-and-forget receipt print.
  enqueueReceipt(active.id).catch(() => undefined);
  // Attach to cashier shift if one is open. No-op when shift feature isn't
  // used — intentional so existing flows keep working.
  if (parsed.data.paymentMethod && parsed.data.paidAmount != null) {
    recordSessionMovement({
      restaurantId: staff.restaurantId,
      sessionId: active.id,
      amount: parsed.data.paidAmount,
      paymentMethod: parsed.data.paymentMethod,
      staffId: staff.sub,
    }).catch(() => undefined);
  }
  // Fire-and-forget e-invoice issuance. No-op when the tenant hasn't enabled
  // an einvoice provider. Failures go to EInvoice.status=FAILED for admin
  // visibility — they never surface to the cashier.
  issueEInvoiceForSession(active.id).catch(() => undefined);
  return NextResponse.json({ ok: true, session: updated });
}
