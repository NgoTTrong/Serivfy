import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { tenantAudit } from "@/lib/tenant-audit";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  address: z.string().max(300).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  timezone: z.string().max(60).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const branch = await prisma.branch.findUnique({ where: { id: params.id } });
  if (!branch || branch.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const upd = await prisma.branch.update({
    where: { id: branch.id },
    data: parsed.data,
  });
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "branch.updated",
    target: branch.id,
    meta: parsed.data,
  });
  return NextResponse.json({ branch: upd });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const branch = await prisma.branch.findUnique({
    where: { id: params.id },
    include: { _count: { select: { tables: true, staff: true, sessions: true } } },
  });
  if (!branch || branch.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  // Soft-disable if the branch has any history — we can't hard-delete
  // without orphaning sessions + receipts.
  if (branch._count.tables > 0 || branch._count.sessions > 0 || branch._count.staff > 0) {
    await prisma.branch.update({
      where: { id: branch.id },
      data: { isActive: false },
    });
    return NextResponse.json({ ok: true, disabled: true });
  }
  await prisma.branch.delete({ where: { id: branch.id } });
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "branch.deleted",
    target: branch.id,
  });
  return NextResponse.json({ ok: true });
}
