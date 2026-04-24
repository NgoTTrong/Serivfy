import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const take = Math.min(
    200,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10)),
  );
  const statusFilter = req.nextUrl.searchParams.get("status") ?? "";

  const rows = await prisma.eInvoice.findMany({
    where: {
      restaurantId: staff.restaurantId,
      ...(statusFilter &&
      ["PENDING", "SUBMITTED", "ISSUED", "FAILED", "REJECTED", "CANCELLED"].includes(statusFilter)
        ? { status: statusFilter }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      session: {
        select: {
          id: true,
          receiptNumber: true,
          closedAt: true,
          table: { select: { label: true } },
        },
      },
    },
  });
  return NextResponse.json({ invoices: rows });
}
