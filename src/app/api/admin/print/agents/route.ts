import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const agents = await prisma.printAgent.findMany({
    where: { restaurantId: staff.restaurantId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      branchId: true,
      version: true,
      lastSeenAt: true,
      createdAt: true,
      revokedAt: true,
      _count: { select: { printers: true } },
    },
  });
  return NextResponse.json({ agents });
}
