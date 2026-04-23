import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformSession } from "@/lib/platform-auth";

export async function GET(req: NextRequest) {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const status = req.nextUrl.searchParams.get("status") ?? "PENDING";
  const where = status === "ALL" ? {} : { status };
  const requests = await prisma.signupRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      restaurantName: true,
      slug: true,
      adminName: true,
      adminEmail: true,
      phone: true,
      address: true,
      planRequested: true,
      note: true,
      status: true,
      reviewedAt: true,
      rejectReason: true,
      createdRestaurantId: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ requests });
}
