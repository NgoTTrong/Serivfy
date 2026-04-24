import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { prisma } from "./prisma";

/**
 * Print Agent auth.
 *
 * Agents present a Bearer token in Authorization headers on every API call.
 * Token is generated once on pairing and the server only keeps the bcrypt
 * hash, matching the OWASP guidance for long-lived credentials. Revocation
 * sets `revokedAt` and the next auth attempt returns null.
 *
 * Short-lived 6-digit pairing codes are human-typable during first-time
 * setup and consumed exactly once.
 */

export function generateAgentToken(): string {
  // 256-bit random, base64url — safe to transport, opaque to the agent.
  return crypto.randomBytes(32).toString("base64url");
}

export function hashAgentToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

export async function verifyAgentToken(token: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(token, hash);
  } catch {
    return false;
  }
}

export function generatePairingCode(): string {
  // 6 digits, no leading-zero suppression — keep padding so users type exactly
  // what they see. Avoids 10% chance of a 5-char code.
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, "0");
}

/**
 * Resolve an incoming agent request to the authenticated PrintAgent row.
 * Also touches `lastSeenAt` so admin UI can show "last ping" status.
 *
 * Token format: `Authorization: Bearer svf.agent.<agentId>.<secret>` — we
 * embed the agentId in the token so lookup is O(1) instead of scanning
 * every hashed row. The secret is still verified via bcrypt against the
 * stored hash.
 */
export async function authenticateAgentRequest(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+svf\.agent\.([^.]+)\.(.+)$/i.exec(header.trim());
  if (!match) return null;
  const [, agentId, secret] = match;

  const agent = await prisma.printAgent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      restaurantId: true,
      branchId: true,
      tokenHash: true,
      revokedAt: true,
      name: true,
    },
  });
  if (!agent || agent.revokedAt) return null;
  const ok = await verifyAgentToken(secret, agent.tokenHash);
  if (!ok) return null;

  // Fire-and-forget lastSeenAt bump so auth doesn't block on a write.
  prisma.printAgent
    .update({
      where: { id: agent.id },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => undefined);

  return agent;
}

export function formatAgentToken(agentId: string, secret: string): string {
  return `svf.agent.${agentId}.${secret}`;
}
