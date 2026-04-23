import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  delta: z.number().int().min(-50).max(50).default(1),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN", "WAITER"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const item = await prisma.orderItem.findUnique({
    where: { id: params.id },
    include: { round: { include: { session: true } } },
  });
  if (!item) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (item.round.session.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const nextServed = Math.max(0, Math.min(item.quantity, item.servedQty + parsed.data.delta));

  await prisma.orderItem.update({
    where: { id: item.id },
    data: { servedQty: nextServed },
  });

  // Check if round fully served
  const remaining = await prisma.orderItem.findMany({
    where: { roundId: item.roundId },
    select: { quantity: true, servedQty: true },
  });
  const allDone = remaining.every((r) => r.servedQty >= r.quantity);
  if (allDone && item.round.status !== "SERVED") {
    await prisma.orderRound.update({
      where: { id: item.roundId },
      data: { status: "SERVED" },
    });
  } else if (!allDone && item.round.status === "SERVED") {
    await prisma.orderRound.update({
      where: { id: item.roundId },
      data: { status: "IN_KITCHEN" },
    });
  }

  return NextResponse.json({ servedQty: nextServed, roundComplete: allDone });
}
