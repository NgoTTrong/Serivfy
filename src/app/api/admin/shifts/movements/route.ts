import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getOpenShift } from "@/lib/shift";

const schema = z.object({
  kind: z.enum(["CASH_IN", "CASH_OUT"]),
  amount: z.number().int().min(1),
  note: z.string().max(200).optional(),
});

/**
 * Manual cash movement mid-shift. Typical uses: owner tops up / takes out
 * the drawer, clerk pays petty-cash expenses, etc. Refund flow is handled
 * elsewhere (attached to a specific session).
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

  const m = await prisma.shiftMovement.create({
    data: {
      shiftId: open.id,
      kind: parsed.data.kind,
      amount: parsed.data.amount,
      note: parsed.data.note ?? null,
      createdByStaffId: staff.sub,
    },
  });
  return NextResponse.json({ movement: m });
}
