import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    include: {
      restaurant: { select: { id: true, name: true, slug: true, tagline: true, logo: true } },
      table: { select: { id: true, label: true, number: true } },
      guests: { select: { id: true, nickname: true } },
    },
  });
  if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "CLOSED", session }, { status: 410 });
  }
  return NextResponse.json({ session });
}
