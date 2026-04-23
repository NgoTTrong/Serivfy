import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMemoryProfile } from "@/lib/memory";

const schema = z.object({
  deviceId: z.string().min(3),
  guestId: z.string(),
});

/**
 * One-tap reorder — copy the customer's last session items into the current cart.
 * Options snapshot is preserved via optionsLabel; if the underlying MenuItem
 * has been removed/disabled, that line is silently skipped.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { id: true, status: true, restaurantId: true },
  });
  if (!session || session.status === "CLOSED") {
    return NextResponse.json({ error: "SESSION_CLOSED" }, { status: 410 });
  }

  const profile = await getMemoryProfile(session.restaurantId, parsed.data.deviceId);
  if (!profile || profile.lastItems.length === 0) {
    return NextResponse.json({ error: "NO_LAST_ORDER" }, { status: 404 });
  }

  // Verify menu items still exist + available
  const menuItems = await prisma.menuItem.findMany({
    where: {
      id: { in: profile.lastItems.map((l) => l.menuItemId) },
      restaurantId: session.restaurantId,
      isAvailable: true,
    },
    select: { id: true, price: true },
  });
  const availableMap = new Map(menuItems.map((m) => [m.id, m.price]));

  let added = 0;
  for (const li of profile.lastItems) {
    const price = availableMap.get(li.menuItemId);
    if (price === undefined) continue;
    await prisma.cartItem.create({
      data: {
        sessionId: session.id,
        guestId: parsed.data.guestId,
        menuItemId: li.menuItemId,
        quantity: li.quantity,
        note: li.note,
        // Re-apply previous options as a display-only label; no options selected
        // since choice IDs may have changed. Admin can re-pick in cart if needed.
        optionsLabel: li.optionsLabel,
        optionsPrice: 0,
      },
    });
    added += 1;
  }

  return NextResponse.json({ added, total: profile.lastItems.length });
}
