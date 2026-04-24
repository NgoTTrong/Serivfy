import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { computeShiftTotals, getOpenShift } from "@/lib/shift";
import { tenantAudit } from "@/lib/tenant-audit";

const schema = z.object({
  closingCashActual: z.number().int().min(0),
  closingNote: z.string().max(500).optional(),
});

/**
 * Close the currently open shift for this restaurant. Snapshots the
 * expected cash (derived from movements) into the Shift row so future
 * reports can display the reconciliation without recomputing history.
 */
export async function POST(req: NextRequest) {
  let staff;
  try {
    staff = await requireRole(["ADMIN", "WAITER"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const open = await getOpenShift(staff.restaurantId);
  if (!open) return NextResponse.json({ error: "NO_OPEN_SHIFT" }, { status: 404 });

  const totals = await computeShiftTotals(open.id);
  if (!totals) return NextResponse.json({ error: "NO_OPEN_SHIFT" }, { status: 404 });

  const updated = await prisma.shift.update({
    where: { id: open.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedByStaffId: staff.sub,
      closingCashActual: parsed.data.closingCashActual,
      closingCashExpected: totals.expectedCash,
      closingNote: parsed.data.closingNote ?? null,
    },
  });
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "shift.closed",
    target: open.id,
    meta: {
      expected: totals.expectedCash,
      actual: parsed.data.closingCashActual,
      diff: parsed.data.closingCashActual - totals.expectedCash,
    },
  });
  return NextResponse.json({
    shift: updated,
    report: {
      ...totals,
      diff: parsed.data.closingCashActual - totals.expectedCash,
    },
  });
}
