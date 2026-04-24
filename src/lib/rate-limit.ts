import type { NextRequest } from "next/server";
import { prisma } from "./prisma";

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}


export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
};

/**
 * Durable fixed-window rate limit backed by Postgres.
 *
 * Uses an atomic INSERT ... ON CONFLICT UPDATE so two concurrent requests for
 * the same key cannot both see an uninitialised row. The window resets lazily
 * when a request arrives after `resetAt` has passed.
 *
 * Good enough for signup / login / password-reset style endpoints at the
 * scale of a SaaS with tens of restaurants. For hot per-request limits
 * consider a Redis/Upstash-backed implementation later.
 */
export async function rateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const { key, limit, windowMs } = params;
  const now = new Date();
  const nextReset = new Date(now.getTime() + windowMs);

  // Single atomic SQL: insert new window, or if inside current window
  // increment count, or if past resetAt reset to 1 with a new resetAt.
  const rows = await prisma.$queryRaw<
    Array<{ count: number; resetAt: Date }>
  >`
    INSERT INTO "RateLimit" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, ${nextReset}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${nextReset} ELSE "RateLimit"."resetAt" END,
      "updatedAt" = ${now}
    RETURNING "count", "resetAt"
  `;

  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const resetAt = row?.resetAt ?? nextReset;
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}
