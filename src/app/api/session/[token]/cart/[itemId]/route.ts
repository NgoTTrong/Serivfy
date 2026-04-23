import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  quantity: z.number().int().min(0).max(50).optional(),
  note: z.string().max(300).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { token: string; itemId: string } }
) {
  const session = await prisma.tableSession.findUnique({ where: { token: params.token } });
  if (!session || session.status === "CLOSED") {
    return NextResponse.json({ error: "SESSION_CLOSED" }, { status: 410 });
  }
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const item = await prisma.cartItem.findUnique({ where: { id: params.itemId } });
  if (!item || item.sessionId !== session.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (parsed.data.quantity === 0) {
    await prisma.cartItem.delete({ where: { id: item.id } });
    return NextResponse.json({ deleted: true });
  }
  const upd = await prisma.cartItem.update({
    where: { id: item.id },
    data: parsed.data,
  });
  return NextResponse.json({ item: upd });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { token: string; itemId: string } }
) {
  const session = await prisma.tableSession.findUnique({ where: { token: params.token } });
  if (!session || session.status === "CLOSED") {
    return NextResponse.json({ error: "SESSION_CLOSED" }, { status: 410 });
  }
  const item = await prisma.cartItem.findUnique({ where: { id: params.itemId } });
  if (!item || item.sessionId !== session.id) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.cartItem.delete({ where: { id: item.id } });
  return NextResponse.json({ ok: true });
}
