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
    500,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10)),
  );
  const actionFilter = req.nextUrl.searchParams.get("action") ?? "";

  const rows = await prisma.tenantAuditLog.findMany({
    where: {
      restaurantId: staff.restaurantId,
      ...(actionFilter ? { action: { startsWith: actionFilter } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  return NextResponse.json({ entries: rows });
}
