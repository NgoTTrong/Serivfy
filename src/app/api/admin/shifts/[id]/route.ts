import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { computeShiftTotals } from "@/lib/shift";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN", "WAITER"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const shift = await prisma.shift.findUnique({
    where: { id: params.id },
    include: {
      openedBy: { select: { id: true, name: true } },
      closedBy: { select: { id: true, name: true } },
      movements: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!shift || shift.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const totals = await computeShiftTotals(shift.id);
  return NextResponse.json({ shift, totals });
}
