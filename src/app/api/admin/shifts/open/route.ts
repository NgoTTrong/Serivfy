import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { tenantAudit } from "@/lib/tenant-audit";

const schema = z.object({
  openingCash: z.number().int().min(0),
  note: z.string().max(500).optional(),
});

/**
 * Open a cashier shift. The partial unique index on (restaurantId, branchId)
 * WHERE status='OPEN' guarantees only one shift is open at a time per
 * branch, so concurrent opens from two devices race safely on the DB.
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

  try {
    const shift = await prisma.shift.create({
      data: {
        restaurantId: staff.restaurantId,
        openedByStaffId: staff.sub,
        openingCash: parsed.data.openingCash,
        note: parsed.data.note ?? null,
      },
    });
    tenantAudit({
      restaurantId: staff.restaurantId,
      actor: { id: staff.sub, name: staff.name },
      action: "shift.opened",
      target: shift.id,
      meta: { openingCash: shift.openingCash },
    });
    return NextResponse.json({ shift });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json(
        { error: "SHIFT_ALREADY_OPEN" },
        { status: 409 },
      );
    }
    throw e;
  }
}
