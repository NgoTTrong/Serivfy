import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

/**
 * Permanently revoke an agent's token. The agent row stays so PrintJob FKs
 * keep resolving, but authentication will fail from here on.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const agent = await prisma.printAgent.findUnique({ where: { id: params.id } });
  if (!agent || agent.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (agent.revokedAt) return NextResponse.json({ ok: true });

  await prisma.printAgent.update({
    where: { id: agent.id },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
