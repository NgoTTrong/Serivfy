import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordVisit } from "@/lib/memory";

const schema = z.object({
  deviceId: z.string().min(3),
  nickname: z.string().max(30).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const session = await prisma.tableSession.findUnique({ where: { token: params.token } });
  if (!session || session.status === "CLOSED") {
    return NextResponse.json({ error: "SESSION_CLOSED" }, { status: 410 });
  }

  // Upsert keyed by the (sessionId, deviceId) unique index prevents the race
  // where two concurrent registers from the same phone (double-tap) create
  // two Guest rows and split order attribution.
  const count = await prisma.guest.count({ where: { sessionId: session.id } });
  const fallbackName = parsed.data.nickname || `Khách ${count + 1}`;
  const guest = await prisma.guest.upsert({
    where: {
      sessionId_deviceId: {
        sessionId: session.id,
        deviceId: parsed.data.deviceId,
      },
    },
    update: parsed.data.nickname ? { nickname: parsed.data.nickname } : {},
    create: {
      sessionId: session.id,
      deviceId: parsed.data.deviceId,
      nickname: fallbackName,
    },
  });

  // Record Memory visit (failure here must never break guest register)
  try {
    await recordVisit({
      restaurantId: session.restaurantId,
      deviceId: parsed.data.deviceId,
      nickname: guest.nickname,
      sessionId: session.id,
    });
  } catch {
    /* swallow — Memory is nice-to-have */
  }

  return NextResponse.json({ guest });
}
