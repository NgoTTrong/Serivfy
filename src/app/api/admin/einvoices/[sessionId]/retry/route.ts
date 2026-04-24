import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { issueEInvoiceForSession } from "@/lib/einvoice";

/**
 * Admin-initiated retry for a FAILED einvoice. Synchronous to keep the UI
 * contract simple — admins click and see the result immediately.
 */
export async function POST(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const session = await prisma.tableSession.findUnique({
    where: { id: params.sessionId },
    select: { restaurantId: true },
  });
  if (!session || session.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  await issueEInvoiceForSession(params.sessionId);
  const invoice = await prisma.eInvoice.findUnique({
    where: { sessionId: params.sessionId },
  });
  return NextResponse.json({ invoice });
}
