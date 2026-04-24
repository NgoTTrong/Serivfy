import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bumpPulse } from "@/lib/pulse";

export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { id: true, status: true, billRequestedAt: true, restaurantId: true },
  });
  if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "CLOSED" }, { status: 410 });
  }

  const updated = await prisma.tableSession.update({
    where: { id: session.id },
    data: { billRequestedAt: session.billRequestedAt ?? new Date() },
    select: { billRequestedAt: true },
  });
  await bumpPulse(session.restaurantId, ["tables", "customer"]);
  return NextResponse.json({ billRequestedAt: updated.billRequestedAt });
}

export async function DELETE(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { id: true, status: true, restaurantId: true },
  });
  if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  if (session.status === "CLOSED") {
    return NextResponse.json({ error: "CLOSED" }, { status: 410 });
  }

  await prisma.tableSession.update({
    where: { id: session.id },
    data: { billRequestedAt: null },
  });
  await bumpPulse(session.restaurantId, ["tables", "customer"]);
  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { billRequestedAt: true, status: true },
  });
  if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({
    billRequestedAt: session.billRequestedAt,
    closed: session.status === "CLOSED",
  });
}
