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
  const status = req.nextUrl.searchParams.get("status") ?? "";
  const take = Math.min(
    200,
    Math.max(1, parseInt(req.nextUrl.searchParams.get("limit") ?? "100", 10)),
  );

  const jobs = await prisma.printJob.findMany({
    where: {
      restaurantId: staff.restaurantId,
      ...(status && ["QUEUED", "DISPATCHED", "DONE", "FAILED"].includes(status)
        ? { status }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      kind: true,
      status: true,
      attempts: true,
      lastError: true,
      createdAt: true,
      dispatchedAt: true,
      processedAt: true,
      sessionId: true,
      roundId: true,
      printer: { select: { id: true, name: true, kind: true } },
    },
  });

  return NextResponse.json({ jobs });
}
