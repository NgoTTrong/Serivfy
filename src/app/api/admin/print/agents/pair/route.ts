import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { generatePairingCode } from "@/lib/print-agent-auth";

const schema = z.object({
  agentName: z.string().min(1).max(60),
  branchId: z.string().max(60).optional().nullable(),
});

const PAIR_TTL_MS = 10 * 60_000;

/**
 * Admin kicks off agent pairing: returns a 6-digit code + expiry. The agent
 * app on the counter PC consumes the code via /api/print/claim to exchange
 * for a long-lived bearer token. Code is single-use and expires in 10 min.
 */
export async function POST(req: NextRequest) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  // Collision guard: retry a few times before giving up. 10^6 code space with
  // ~10 min TTL means collisions are astronomically rare but non-zero.
  let code = "";
  for (let i = 0; i < 5; i++) {
    const candidate = generatePairingCode();
    const existing = await prisma.printPairing.findUnique({ where: { code: candidate } });
    if (!existing || existing.consumedAt || existing.expiresAt < new Date()) {
      code = candidate;
      break;
    }
  }
  if (!code) return NextResponse.json({ error: "CODE_COLLISION" }, { status: 503 });

  const expiresAt = new Date(Date.now() + PAIR_TTL_MS);
  const pairing = await prisma.printPairing.create({
    data: {
      restaurantId: staff.restaurantId,
      branchId: parsed.data.branchId ?? null,
      agentName: parsed.data.agentName.trim(),
      code,
      expiresAt,
    },
  });

  return NextResponse.json({
    pairingId: pairing.id,
    code,
    expiresAt: expiresAt.toISOString(),
    // Agent downloads from here and enters the code in its setup wizard.
    downloadUrl: "https://servify.vn/download/print-agent/windows",
  });
}
