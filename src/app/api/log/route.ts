import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * Sink for browser-side error reports so every error — client or server —
 * ends up as a structured stdout line captured by Axiom. Anonymous (no auth)
 * but rate-limited per IP so a rogue tab can't flood the dataset.
 */
const schema = z.object({
  event: z.string().min(1).max(120).default("browser.error"),
  severity: z.enum(["info", "warn", "critical"]).default("critical"),
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  digest: z.string().max(120).optional(),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  tenantId: z.string().max(120).optional(),
  route: z.string().max(200).optional(),
  extra: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const bucket = await rateLimit({
    key: `log:${ip}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!bucket.allowed) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  }

  const d = parsed.data;
  const meta = {
    source: "browser",
    severity: d.severity,
    digest: d.digest,
    url: d.url,
    userAgent: d.userAgent ?? req.headers.get("user-agent"),
    tenantId: d.tenantId,
    route: d.route,
    ip,
    ...d.extra,
  };

  if (d.severity === "critical") {
    // Synthetic Error so logger.error extracts name+stack into errStack/errMessage
    // just like a native exception.
    const err = new Error(d.message);
    if (d.stack) err.stack = d.stack;
    logger.error(d.event, err, meta);
  } else if (d.severity === "warn") {
    logger.warn(d.event, { message: d.message, stack: d.stack, ...meta });
  } else {
    logger.info(d.event, { message: d.message, ...meta });
  }

  return NextResponse.json({ ok: true });
}
