import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { bumpPulse } from "@/lib/pulse";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { id: true, status: true },
  });
  if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const items = await prisma.cartItem.findMany({
    where: { sessionId: session.id },
    include: {
      menuItem: { select: { id: true, name: true, price: true, image: true } },
      guest: { select: { id: true, nickname: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items });
}

const addSchema = z.object({
  guestId: z.string(),
  menuItemId: z.string(),
  quantity: z.number().int().min(1).max(50),
  note: z.string().max(300).optional(),
  // choiceIds: ordered union of selected MenuOptionChoice ids
  choiceIds: z.array(z.string()).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json();
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { id: true, status: true, restaurantId: true },
  });
  if (!session || session.status === "CLOSED") {
    return NextResponse.json({ error: "SESSION_CLOSED" }, { status: 410 });
  }

  const menuItem = await prisma.menuItem.findUnique({
    where: { id: parsed.data.menuItemId },
    include: {
      optionGroups: {
        include: { choices: true },
      },
    },
  });
  if (!menuItem || !menuItem.isAvailable || menuItem.deletedAt) {
    return NextResponse.json({ error: "ITEM_UNAVAILABLE" }, { status: 400 });
  }

  // Validate options + compute label/price/key
  const chosenIds = parsed.data.choiceIds ?? [];
  let optionsPrice = 0;
  const labelParts: string[] = [];
  const sortedChosenForKey: string[] = [];

  // Gather choices per group to enforce required / multiple rules
  for (const group of menuItem.optionGroups) {
    const chosenInGroup = group.choices.filter((c) => chosenIds.includes(c.id));
    if (group.required && chosenInGroup.length === 0) {
      return NextResponse.json(
        { error: "OPTION_REQUIRED", groupName: group.name },
        { status: 400 },
      );
    }
    if (!group.multiple && chosenInGroup.length > 1) {
      return NextResponse.json(
        { error: "OPTION_SINGLE_ONLY", groupName: group.name },
        { status: 400 },
      );
    }
    for (const c of chosenInGroup) {
      optionsPrice += c.priceDelta;
      labelParts.push(c.label);
      sortedChosenForKey.push(c.id);
    }
  }
  const optionsLabel = labelParts.length ? labelParts.join(", ") : null;
  const optionsKey = sortedChosenForKey.sort().join("|") || null;

  // Dedupe: same menuItem + same guest + same optionsKey + same note → increment qty
  const existing = await prisma.cartItem.findFirst({
    where: {
      sessionId: session.id,
      guestId: parsed.data.guestId,
      menuItemId: parsed.data.menuItemId,
      note: parsed.data.note ?? null,
      optionsKey: optionsKey,
    },
  });
  let item;
  if (existing) {
    item = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + parsed.data.quantity },
    });
  } else {
    item = await prisma.cartItem.create({
      data: {
        sessionId: session.id,
        guestId: parsed.data.guestId,
        menuItemId: parsed.data.menuItemId,
        quantity: parsed.data.quantity,
        note: parsed.data.note,
        optionsLabel,
        optionsPrice,
        optionsKey,
      },
    });
  }
  await bumpPulse(session.restaurantId, "customer");
  return NextResponse.json({ item });
}
