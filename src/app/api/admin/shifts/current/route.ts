import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { computeShiftTotals, getOpenShift } from "@/lib/shift";

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN", "WAITER"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const open = await getOpenShift(staff.restaurantId);
  if (!open) return NextResponse.json({ shift: null });

  // Re-fetch with relations the UI expects (openedBy + closedBy names).
  const shift = await prisma.shift.findUnique({
    where: { id: open.id },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
    },
  });
  const totals = await computeShiftTotals(open.id);
  return NextResponse.json({ shift, totals });
}
