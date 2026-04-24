import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { tenantAudit } from "@/lib/tenant-audit";

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
  // Soft-disable + bump tokenVersion so any in-flight JWT is rejected by the
  // auth cache within TTL. We keep the row so historical OrderRound / audit
  // FKs stay intact. Email is released by a random suffix so the old address
  // can be reused for a new staff record.
  await prisma.staff.update({
    where: { id: s.id },
    data: {
      isActive: false,
      tokenVersion: { increment: 1 },
      email: `${s.email}__removed_${Date.now()}`,
    },
  });
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "staff.deactivated",
    target: s.id,
    meta: { name: s.name, role: s.role },
  });
  return NextResponse.json({ ok: true });
}
