import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    include: {
      restaurant: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          taxCode: true,
          bankName: true,
          bankAccountNumber: true,
          bankAccountHolder: true,
        },
      },
      table: { select: { label: true, number: true } },
      guests: { select: { id: true, nickname: true } },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          items: {
            include: {
              menuItem: { select: { name: true } },
              guest: { select: { nickname: true } },
            },
          },
        },
      },
    },
  });
  if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Flatten items into lines — merge rows with same menuItem+options+note across rounds.
  type Line = {
    orderItemIds: string[]; // used for split bill
    guestIds: (string | null)[];
    menuItemId: string;
    name: string;
    unitPrice: number;
    quantity: number;
    note: string | null;
    optionsLabel: string | null;
    subtotal: number;
  };
  const lines: Line[] = [];
  for (const r of session.rounds) {
    for (const it of r.items) {
      const existing = lines.find(
        (l) =>
          l.menuItemId === it.menuItemId &&
          l.unitPrice === it.priceAtOrder &&
          (l.note ?? "") === (it.note ?? "") &&
          (l.optionsLabel ?? "") === (it.optionsLabel ?? ""),
      );
      if (existing) {
        existing.quantity += it.quantity;
        existing.subtotal += it.priceAtOrder * it.quantity;
        existing.orderItemIds.push(it.id);
        existing.guestIds.push(it.guestId);
      } else {
        lines.push({
          orderItemIds: [it.id],
          guestIds: [it.guestId],
          menuItemId: it.menuItemId,
          name: it.menuItem.name,
          unitPrice: it.priceAtOrder,
          quantity: it.quantity,
          note: it.note,
          optionsLabel: it.optionsLabel,
          subtotal: it.priceAtOrder * it.quantity,
        });
      }
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const discount = session.discountAmount ?? 0;
  const total = Math.max(0, subtotal - discount);

  return NextResponse.json({
    session: {
      id: session.id,
      token: session.token,
      status: session.status,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      billRequestedAt: session.billRequestedAt,
      paymentMethod: session.paymentMethod,
      paidAmount: session.paidAmount,
      paidAt: session.paidAt,
      receiptNumber: session.receiptNumber,
      discountAmount: discount,
      voucherCode: session.voucherCode,
      voucherLabel: session.voucherLabel,
    },
    restaurant: session.restaurant,
    table: session.table,
    guests: session.guests,
    lines,
    // Raw per-order items — used for split-bill calculations
    rawItems: session.rounds.flatMap((r) =>
      r.items.map((it) => ({
        id: it.id,
        menuItemId: it.menuItemId,
        name: it.menuItem.name,
        guestId: it.guestId,
        guestNickname: it.guest?.nickname ?? null,
        quantity: it.quantity,
        unitPrice: it.priceAtOrder,
        subtotal: it.priceAtOrder * it.quantity,
        optionsLabel: it.optionsLabel,
        note: it.note,
      })),
    ),
    subtotal,
    discount,
    total,
  });
}
