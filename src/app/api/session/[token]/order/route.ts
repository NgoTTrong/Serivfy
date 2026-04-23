import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    include: {
      cartItems: { include: { menuItem: true } },
      rounds: { orderBy: { roundNumber: "desc" }, take: 1 },
    },
  });
  if (!session || session.status === "CLOSED") {
    return NextResponse.json({ error: "SESSION_CLOSED" }, { status: 410 });
  }
  if (session.cartItems.length === 0) {
    return NextResponse.json({ error: "CART_EMPTY" }, { status: 400 });
  }

  const nextNumber = (session.rounds[0]?.roundNumber ?? 0) + 1;

  const round = await prisma.$transaction(async (tx) => {
    const created = await tx.orderRound.create({
      data: { sessionId: session.id, roundNumber: nextNumber },
    });
    for (const ci of session.cartItems) {
      await tx.orderItem.create({
        data: {
          roundId: created.id,
          guestId: ci.guestId,
          menuItemId: ci.menuItemId,
          quantity: ci.quantity,
          note: ci.note,
          // priceAtOrder is the full unit price incl. options snapshot
          priceAtOrder: ci.menuItem.price + ci.optionsPrice,
          optionsLabel: ci.optionsLabel,
          optionsPrice: ci.optionsPrice,
        },
      });
    }
    await tx.cartItem.deleteMany({ where: { sessionId: session.id } });
    return created;
  });

  return NextResponse.json({ roundId: round.id, roundNumber: round.roundNumber });
}
