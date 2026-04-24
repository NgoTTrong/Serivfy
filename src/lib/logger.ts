/**
 * Minimal structured logger.
 *
 * Writes JSON lines to stdout/stderr so Vercel's log drain (or any sink like
 * Axiom / Better Stack) captures them natively — no third-party SDK, no DSN.
 * If/when Sentry is adopted, swap `captureException` to call `Sentry.captureException`.
 *
 * Usage:
 *   logger.info("order.round.created", { sessionId, roundNumber });
 *   logger.error("cart.add.failed", err, { sessionId });
 */

type Level = "debug" | "info" | "warn" | "error";
export type Severity = "info" | "warn" | "critical";

type Meta = Record<string, unknown>;

function emit(level: Level, event: string, meta: Meta) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    service: "servify",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    region: process.env.VERCEL_REGION,
    commit: process.env.VERCEL_GIT_COMMIT_SHA,
    deployment: process.env.VERCEL_DEPLOYMENT_ID,
    ...meta,
  };
  const serialized = JSON.stringify(line);
  if (level === "error" || level === "warn") console.error(serialized);
  else console.log(serialized);
}

function errorMeta(err: unknown): Meta {
  if (err instanceof Error) {
    return {
      errName: err.name,
      errMessage: err.message,
      errStack: err.stack,
      errCause: err.cause instanceof Error ? err.cause.message : undefined,
    };
  }
  return { err: String(err) };
}

export const logger = {
  debug(event: string, meta: Meta = {}) {
    if (process.env.NODE_ENV === "production") return;
    emit("debug", event, meta);
  },
  info(event: string, meta: Meta = {}) {
    emit("info", event, meta);
  },
  warn(event: string, meta: Meta = {}) {
    emit("warn", event, { severity: "warn", ...meta });
  },
  error(event: string, err: unknown, meta: Meta = {}) {
    // Default severity for `error` is "critical" so Axiom alert rules
    // can filter on it. Callers can override with meta.severity = "warn".
    emit("error", event, {
      severity: "critical",
      ...errorMeta(err),
      ...meta,
    });
  },
};

/**
 * Wrap an async route handler so uncaught exceptions log with context and
 * return a 500 instead of leaking stack traces to the client.
 *
 * Captures request URL + method + a short requestId so Axiom queries can
 * correlate browser-side and server-side entries for the same incident.
 */
export function withRouteLogging<R>(
  name: string,
  handler: (req: Request, ctx: unknown) => Promise<R>,
): (req: Request, ctx: unknown) => Promise<R | Response> {
  return async (req, ctx) => {
    const requestId =
      req.headers.get("x-request-id") ??
      req.headers.get("x-vercel-id") ??
      Math.random().toString(36).slice(2, 10);
    try {
      return await handler(req, ctx);
    } catch (err) {
      logger.error(`route.${name}.unhandled`, err, {
        route: name,
        requestId,
        method: req.method,
        url: req.url,
      });
      return new Response(
        JSON.stringify({ error: "INTERNAL", requestId }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "x-request-id": requestId,
          },
        },
      );
    }
  };
}
