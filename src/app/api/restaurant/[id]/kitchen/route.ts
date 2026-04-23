import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const staff = await requireRole(["ADMIN", "KITCHEN"]);
    if (staff.restaurantId !== params.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const rounds = await prisma.orderRound.findMany({
    where: {
      status: "IN_KITCHEN",
      session: { restaurantId: params.id },
    },
    orderBy: { createdAt: "asc" },
    include: {
      session: { include: { table: { select: { label: true, number: true } } } },
      items: {
        include: { menuItem: { select: { name: true } }, guest: { select: { nickname: true } } },
      },
    },
  });
  return NextResponse.json({ rounds });
}
