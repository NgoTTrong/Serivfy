import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { id: true },
  });
  if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const rounds = await prisma.orderRound.findMany({
    where: { sessionId: session.id },
    orderBy: { roundNumber: "asc" },
    include: {
      items: {
        include: {
          menuItem: { select: { name: true, image: true } },
          guest: { select: { nickname: true } },
        },
      },
    },
  });
  return NextResponse.json({ rounds });
}
