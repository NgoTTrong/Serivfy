import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { restaurantId: true, status: true },
  });
  if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const categories = await prisma.category.findMany({
    where: { restaurantId: session.restaurantId, deletedAt: null },
    orderBy: { order: "asc" },
    include: {
      menuItems: {
        where: { deletedAt: null },
        orderBy: [{ order: "asc" }, { name: "asc" }],
        include: {
          optionGroups: {
            orderBy: { order: "asc" },
            include: { choices: { orderBy: { order: "asc" } } },
          },
        },
      },
    },
  });
  return NextResponse.json({ categories });
}
