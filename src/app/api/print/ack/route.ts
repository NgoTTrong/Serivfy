import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authenticateAgentRequest } from "@/lib/print-agent-auth";

const MAX_ATTEMPTS = 5;

const schema = z.object({
  jobId: z.string(),
  result: z.enum(["DONE", "FAILED"]),
  error: z.string().max(500).optional(),
  /** If true + FAILED + attempts < MAX, the job is re-queued instead of parked. */
  retry: z.boolean().optional(),
});

/**
 * Agent reports the outcome of a dispatched job.
 * DONE      → status=DONE, processedAt=now
 * FAILED    → re-queue if caller asked and attempts < MAX_ATTEMPTS, else park
 *
 * We verify the job belongs to a printer owned by the authenticated agent
 * so one tenant's agent can't mark another tenant's jobs as done.
 */
export async function POST(req: NextRequest) {
  const agent = await authenticateAgentRequest(req);
  if (!agent) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const job = await prisma.printJob.findUnique({
    where: { id: parsed.data.jobId },
    include: { printer: { select: { agentId: true, id: true } } },
  });
  if (!job || job.printer.agentId !== agent.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const now = new Date();
  if (parsed.data.result === "DONE") {
    await prisma.printJob.update({
      where: { id: job.id },
      data: { status: "DONE", processedAt: now, lastError: null },
    });
    await prisma.printer.update({
      where: { id: job.printer.id },
      data: { lastSeenAt: now },
    });
    return NextResponse.json({ ok: true });
  }

  // FAILED path
  const shouldRetry =
    (parsed.data.retry ?? false) && job.attempts < MAX_ATTEMPTS;
  await prisma.printJob.update({
    where: { id: job.id },
    data: {
      status: shouldRetry ? "QUEUED" : "FAILED",
      lastError: parsed.data.error ?? "agent reported failure",
      processedAt: shouldRetry ? null : now,
      // Clear dispatchedAt when re-queuing so stale-sweepers don't act on it.
      dispatchedAt: shouldRetry ? null : job.dispatchedAt,
    },
  });
  return NextResponse.json({ ok: true, requeued: shouldRetry });
}
