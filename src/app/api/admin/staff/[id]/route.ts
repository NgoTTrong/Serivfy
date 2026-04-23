import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (params.id === staff.sub) {
    return NextResponse.json({ error: "CANT_DELETE_SELF" }, { status: 400 });
  }
  const s = await prisma.staff.findUnique({ where: { id: params.id } });
  if (!s || s.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await prisma.staff.delete({ where: { id: s.id } });
  return NextResponse.json({ ok: true });
}
