import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { authenticateAgentRequest } from "@/lib/print-agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Agents reconnect automatically after Fluid's 5-minute streaming cap.
export const maxDuration = 300;

const POLL_INTERVAL_MS = 2000;

/**
 * SSE firehose for a paired Print Agent. The agent opens this connection
 * once and receives newly queued print jobs as they arrive.
 *
 * Delivery model — at-least-once:
 *   1. Server atomically flips the job's status QUEUED → DISPATCHED so two
 *      poller instances can't hand the same job to the same agent twice.
 *   2. Agent processes + ACKs DONE. Agents can also report FAILED with
 *      a `retry` hint to put the job back into the QUEUED pool.
 *   3. If the agent never ACKs (process crash, network drop) the job stays
 *      in DISPATCHED; a sweeper (future cron) re-queues jobs that have been
 *      DISPATCHED for > N minutes.
 *
 * `attempts` increments each dispatch so a permanently bad job gets parked
 * in FAILED after too many retries.
 */
export async function GET(req: NextRequest) {
  const agent = await authenticateAgentRequest(req);
  if (!agent) {
    return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const safe = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };
      const sendEvent = (event: string, data: unknown) => {
        safe(encoder.encode(`event: ${event}\n`));
        safe(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const sendComment = (text: string) => safe(encoder.encode(`: ${text}\n\n`));

      sendEvent("ready", {
        agentId: agent.id,
        agentName: agent.name,
        serverTime: new Date().toISOString(),
      });

      async function dispatchPending() {
        const printerIds = (
          await prisma.printer.findMany({
            where: { agentId: agent!.id, isActive: true },
            select: { id: true },
          })
        ).map((p) => p.id);
        if (printerIds.length === 0) return;

        const candidates = await prisma.printJob.findMany({
          where: { printerId: { in: printerIds }, status: "QUEUED" },
          orderBy: { createdAt: "asc" },
          take: 20,
          select: { id: true },
        });

        for (const c of candidates) {
          const claim = await prisma.printJob.updateMany({
            where: { id: c.id, status: "QUEUED" },
            data: {
              status: "DISPATCHED",
              dispatchedAt: new Date(),
              attempts: { increment: 1 },
            },
          });
          if (claim.count !== 1) continue; // another poller won
          const job = await prisma.printJob.findUnique({
            where: { id: c.id },
            select: {
              id: true,
              kind: true,
              payload: true,
              printerId: true,
              sessionId: true,
              roundId: true,
              attempts: true,
            },
          });
          if (!job) continue;
          sendEvent("job", job);
        }
      }

      // First burst on connect — hand over anything queued while the agent
      // was offline.
      try {
        await dispatchPending();
      } catch {
        /* swallow; next tick will retry */
      }

      const poller = setInterval(() => {
        dispatchPending().catch(() => undefined);
      }, POLL_INTERVAL_MS);

      // Heartbeat keeps proxies / ISP NAT from tearing down an idle agent
      // connection. Also touches lastSeenAt so admin UI shows "online".
      const heartbeat = setInterval(() => {
        sendComment("ka");
        prisma.printAgent
          .update({
            where: { id: agent!.id },
            data: { lastSeenAt: new Date() },
          })
          .catch(() => undefined);
      }, 20_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(poller);
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
