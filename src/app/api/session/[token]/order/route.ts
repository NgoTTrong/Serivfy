import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { prismaDirect } from "@/lib/prisma-direct";
import { bumpPulse } from "@/lib/pulse";
import { enqueueKitchenTickets } from "@/lib/print-dispatch";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { id: true, status: true, restaurantId: true },
  });
  if (!session || session.status === "CLOSED") {
    return NextResponse.json({ error: "SESSION_CLOSED" }, { status: 410 });
  }

  // Advisory lock on session id prevents two concurrent submit-cart calls from
  // both computing the same `nextNumber` and racing on the unique index.
  const round = await prismaDirect.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      `svf:session:${session.id}`,
    );
    const cartItems = await tx.cartItem.findMany({
      where: { sessionId: session.id },
      include: { menuItem: true },
    });
    if (cartItems.length === 0) return null;

    const last = await tx.orderRound.findFirst({
      where: { sessionId: session.id },
      orderBy: { roundNumber: "desc" },
      select: { roundNumber: true },
    });
    const nextNumber = (last?.roundNumber ?? 0) + 1;

    const created = await tx.orderRound.create({
      data: { sessionId: session.id, roundNumber: nextNumber },
    });
    for (const ci of cartItems) {
      await tx.orderItem.create({
        data: {
          roundId: created.id,
          guestId: ci.guestId,
          menuItemId: ci.menuItemId,
          quantity: ci.quantity,
          note: ci.note,
          priceAtOrder: ci.menuItem.price + ci.optionsPrice,
          optionsLabel: ci.optionsLabel,
          optionsPrice: ci.optionsPrice,
        },
      });
    }
    await tx.cartItem.deleteMany({ where: { sessionId: session.id } });
    return created;
  });

  if (!round) return NextResponse.json({ error: "CART_EMPTY" }, { status: 400 });

  await bumpPulse(session.restaurantId, ["kitchen", "tables", "customer"]);
  // Fire-and-forget: printing is non-critical — a broken printer shouldn't
  // block the customer submitting their order.
  enqueueKitchenTickets(round.id).catch(() => undefined);
  return NextResponse.json({ roundId: round.id, roundNumber: round.roundNumber });
}
