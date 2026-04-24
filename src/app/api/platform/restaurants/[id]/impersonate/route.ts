import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signStaffSession, authCookieName } from "@/lib/auth";
import { getPlatformSession, audit } from "@/lib/platform-auth";

const IMPERSONATE_COOKIE = "servify_impersonating";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const restaurant = await prisma.restaurant.findUnique({ where: { id: params.id } });
  if (!restaurant) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const admin = await prisma.staff.findFirst({
    where: { restaurantId: restaurant.id, role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    return NextResponse.json({ error: "NO_ADMIN_IN_RESTAURANT" }, { status: 400 });
  }

  const token = await signStaffSession({
    sub: admin.id,
    restaurantId: admin.restaurantId,
    role: admin.role as "ADMIN" | "WAITER" | "KITCHEN",
    name: admin.name,
    branchId: admin.branchId ?? null,
    sv: admin.tokenVersion,
    rv: restaurant.tokenVersion,
  });

  const res = NextResponse.json({
    ok: true,
    redirectTo: `/admin/${restaurant.id}/dashboard`,
  });
  // Set staff session cookie (short-lived for impersonation)
  res.cookies.set(authCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 2, // 2 hours
  });
  // Marker cookie the admin UI can read to show banner
  res.cookies.set(IMPERSONATE_COOKIE, "1", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2,
  });

  audit({ id: s.sub, name: s.name }, "IMPERSONATE", restaurant.id, {
    restaurantName: restaurant.name,
    adminEmail: admin.email,
  });
  return res;
}
