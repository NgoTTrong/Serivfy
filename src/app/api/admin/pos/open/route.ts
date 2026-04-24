import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { findOrCreateSessionForTableId } from "@/lib/session-guard";
import { bumpPulse } from "@/lib/pulse";

const schema = z.object({
  tableId: z.string(),
});

/**
 * Staff opens (or rejoins) a table for POS ordering.
 *
 * Contract:
 *   - Active session for the table is reused; no session created if the
 *     customer already scanned the QR.
 *   - A "staff guest" is created or reused on the session, keyed by a
 *     synthetic deviceId `staff:<staffId>` so repeated opens don't spawn
 *     new Guest rows. Orders placed through POS attribute to this guest
 *     and display with the staff member's name on tickets.
 *
 * Returns the session token so the POS UI can drive the existing
 * `/api/session/[token]/*` endpoints without a separate POS-specific API
 * surface.
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

  const result = await findOrCreateSessionForTableId(
    parsed.data.tableId,
    staff.restaurantId,
  );
  if (!result) return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 });
  // Branch-scoped staff can only open tables in their own branch. HQ staff
  // (branchId=null) can open any table.
  if (staff.branchId && result.table.branchId && result.table.branchId !== staff.branchId) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const deviceId = `staff:${staff.sub}`;
  const nickname = `NV · ${staff.name}`;

  const guest = await prisma.guest.upsert({
    where: {
      sessionId_deviceId: {
        sessionId: result.session.id,
        deviceId,
      },
    },
    update: { nickname },
    create: {
      sessionId: result.session.id,
      deviceId,
      nickname,
    },
  });

  await bumpPulse(staff.restaurantId, ["tables", "customer"]);

  return NextResponse.json({
    sessionToken: result.session.token,
    sessionId: result.session.id,
    guestId: guest.id,
    table: {
      id: result.table.id,
      number: result.table.number,
      label: result.table.label,
    },
  });
}
