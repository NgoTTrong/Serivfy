import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { getActiveSessionByToken } from "@/lib/session-guard";
import { readPulse, type PulseScope } from "@/lib/pulse";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Fluid Compute caps streaming functions at 300s. EventSource auto-reconnects
// after this, so users see a <1s blip every 5 minutes in the worst case.
export const maxDuration = 300;

const ALLOWED: Record<string, PulseScope> = {
  kitchen: "kitchen",
  tables: "tables",
  menu: "menu",
  customer: "customer",
};

// ── Instance-level shared poller ────────────────────────────────────────────
//
// Without this every connected client would trigger its own DB read. Instead
// we keep one poller per (restaurantId, scope) on each Fluid Compute instance
// and fan out the resulting version number to all SSE streams on that
// instance. Multi-instance is fine because every instance polls independently
// and each client is stuck on one instance at a time.
//
// Memory is bounded: when the last listener unsubscribes the interval is
// cleared and the entry deleted.

type Poller = {
  version: number;
  listeners: Set<(v: number) => void>;
  interval: NodeJS.Timeout;
};

const pollers = new Map<string, Poller>();
const POLL_INTERVAL_MS = 1000;

function subscribe(
  restaurantId: string,
  scope: PulseScope,
  fn: (v: number) => void,
): { unsubscribe: () => void; initial: Promise<number> } {
  const key = `${restaurantId}:${scope}`;
  let p = pollers.get(key);
  const initial = readPulse(restaurantId, scope);
  if (!p) {
    const fresh: Poller = {
      version: -1,
      listeners: new Set([fn]),
      interval: setInterval(async () => {
        try {
          const v = await readPulse(restaurantId, scope);
          const current = pollers.get(key);
          if (!current) return;
          if (v !== current.version) {
            current.version = v;
            for (const listener of current.listeners) {
              try {
                listener(v);
              } catch {
                /* listener isolation */
              }
            }
          }
        } catch {
          /* transient DB blip; next tick retries */
        }
      }, POLL_INTERVAL_MS),
    };
    // Seed version asynchronously so the first tick doesn't fire a redundant
    // event right after we already sent the initial payload to the client.
    initial.then((v) => {
      fresh.version = v;
    }).catch(() => undefined);
    pollers.set(key, fresh);
    p = fresh;
  } else {
    p.listeners.add(fn);
  }

  return {
    unsubscribe: () => {
      const entry = pollers.get(key);
      if (!entry) return;
      entry.listeners.delete(fn);
      if (entry.listeners.size === 0) {
        clearInterval(entry.interval);
        pollers.delete(key);
      }
    },
    initial,
  };
}

// ────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const scopeParam = req.nextUrl.searchParams.get("scope") ?? "";
  const scope = ALLOWED[scopeParam];
  if (!scope) {
    return new Response(JSON.stringify({ error: "BAD_SCOPE" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Same access rules as the pulse endpoint: staff session bound to this
  // restaurant, or a valid customer session token for the customer scope.
  let authorized = false;
  if (scope === "customer") {
    const token = req.nextUrl.searchParams.get("token");
    if (token) {
      const session = await getActiveSessionByToken(token);
      if (session && session.restaurantId === params.id) authorized = true;
    }
  }
  if (!authorized) {
    const staff = await getStaffSession();
    if (staff && staff.restaurantId === params.id) authorized = true;
  }
  if (!authorized) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const exists = await prisma.restaurant.count({ where: { id: params.id } });
  if (!exists) {
    return new Response(JSON.stringify({ error: "NOT_FOUND" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };
      const sendEvent = (data: unknown) => {
        safeEnqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const sendComment = (text: string) => {
        safeEnqueue(encoder.encode(`: ${text}\n\n`));
      };

      // EventSource retry hint: 3s if the connection drops (covers the 5 min
      // maxDuration rollover).
      safeEnqueue(encoder.encode(`retry: 3000\n\n`));

      const { unsubscribe, initial } = subscribe(params.id, scope, (v) => {
        sendEvent({ scope, version: v });
      });

      try {
        const v0 = await initial;
        sendEvent({ scope, version: v0 });
      } catch {
        sendEvent({ scope, version: 0 });
      }

      // Heartbeat every 20s so proxies / mobile radios don't tear down an
      // idle stream mid-service.
      const heartbeat = setInterval(() => sendComment("ka"), 20_000);

      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        if (!closed) {
          closed = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      };

      req.signal.addEventListener("abort", () => {
        cleanup?.();
      });
    },
    cancel() {
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Nginx/CDN buffering would hold the stream — disable it.
      "X-Accel-Buffering": "no",
    },
  });
}
