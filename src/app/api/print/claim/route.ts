import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  formatAgentToken,
  generateAgentToken,
  hashAgentToken,
} from "@/lib/print-agent-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/),
  /** Agent-reported machine hostname + OS info for the admin UI. */
  hostname: z.string().max(100).optional(),
  os: z.string().max(60).optional(),
  version: z.string().max(30).optional(),
});

/**
 * Agent → server: exchange a 6-digit pairing code for a long-lived bearer
 * token. Rate-limited aggressively per IP because this is the only
 * unauthenticated path that mints credentials.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const bucket = await rateLimit({
    key: `print-claim:${ip}`,
    limit: 20,
    windowMs: 60_000,
  });
  if (!bucket.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const pairing = await prisma.printPairing.findUnique({
    where: { code: parsed.data.code },
  });
  if (!pairing) return NextResponse.json({ error: "INVALID_CODE" }, { status: 404 });
  if (pairing.consumedAt) {
    return NextResponse.json({ error: "ALREADY_USED" }, { status: 409 });
  }
  if (pairing.expiresAt < new Date()) {
    return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
  }

  // Atomic claim: consume pairing + create agent in one transaction so the
  // code can't be redeemed twice if two agents type it at the same moment.
  const secret = generateAgentToken();
  const tokenHash = await hashAgentToken(secret);

  const result = await prisma.$transaction(async (tx) => {
    const still = await tx.printPairing.findUnique({
      where: { id: pairing.id },
      select: { consumedAt: true },
    });
    if (still?.consumedAt) return null;

    const agent = await tx.printAgent.create({
      data: {
        restaurantId: pairing.restaurantId,
        branchId: pairing.branchId,
        name: pairing.agentName,
        tokenHash,
        version: parsed.data.version ?? null,
      },
      select: { id: true, name: true, restaurantId: true },
    });
    await tx.printPairing.update({
      where: { id: pairing.id },
      data: { consumedAt: new Date() },
    });
    return agent;
  });

  if (!result) return NextResponse.json({ error: "ALREADY_USED" }, { status: 409 });

  return NextResponse.json({
    agentId: result.id,
    agentName: result.name,
    restaurantId: result.restaurantId,
    token: formatAgentToken(result.id, secret),
  });
}
