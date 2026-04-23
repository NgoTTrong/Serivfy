import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { settleSessionToMemory } from "@/lib/memory";

const schema = z
  .object({
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD"]).optional(),
    paidAmount: z.number().int().min(0).optional(),
  })
  .partial();

function makeReceiptNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
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
  const updated = await prisma.tableSession.update({
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

  // Attribute spend + favorites to Servify Memory (non-blocking).
  try {
    await settleSessionToMemory(active.id);
  } catch {
    /* swallow */
  }

  return NextResponse.json({ ok: true, session: updated });
}
