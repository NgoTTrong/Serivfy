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

  const rows = await prisma.bankTransaction.findMany({
    where: {
      restaurantId: staff.restaurantId,
      ...(statusFilter &&
      ["MATCHED", "UNMATCHED", "AMBIGUOUS", "MANUAL_MATCHED"].includes(statusFilter)
        ? { matchStatus: statusFilter }
        : {}),
    },
    orderBy: { receivedAt: "desc" },
    take,
  });
  return NextResponse.json({ transactions: rows });
}
