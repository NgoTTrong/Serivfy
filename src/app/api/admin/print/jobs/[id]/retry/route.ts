import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * Admin-initiated retry of a FAILED (or stuck DISPATCHED) job. Resets it
 * back to QUEUED so the next agent poll picks it up again. Resetting
 * `attempts` to 0 lets the at-least-once loop retry the full backoff chain
 * — appropriate when the cause was operator error (out of paper) rather
 * than a permanently bad payload.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const job = await prisma.printJob.findUnique({ where: { id: params.id } });
  if (!job || job.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (job.status === "DONE") {
    return NextResponse.json({ error: "ALREADY_DONE" }, { status: 400 });
  }

  await prisma.printJob.update({
    where: { id: job.id },
    data: {
      status: "QUEUED",
      attempts: 0,
      lastError: null,
      dispatchedAt: null,
      processedAt: null,
    },
  });
  return NextResponse.json({ ok: true });
}
