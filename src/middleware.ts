import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PLATFORM_COOKIE = "servify_platform_session";
const SECRET = new TextEncoder().encode(
  (process.env.AUTH_SECRET || "dev-secret-change-me") + ":platform",
);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Superadmin route guard (except login). Middleware runs on Edge, so we can
  // only do stateless JWT verification here — any DB-backed checks live in
  // the individual route handlers (Node runtime).
  if (pathname.startsWith("/superadmin") && pathname !== "/superadmin/login") {
    const token = req.cookies.get(PLATFORM_COOKIE)?.value;
    let ok = false;
    if (token) {
      try {
        await jwtVerify(token, SECRET);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      return NextResponse.redirect(new URL("/superadmin/login", req.url));
    }
  }

  // Platform API guard (except login)
  if (
    pathname.startsWith("/api/platform/") &&
    pathname !== "/api/platform/login" &&
    pathname !== "/api/platform/logout" &&
    pathname !== "/api/platform/me"
  ) {
    const token = req.cookies.get(PLATFORM_COOKIE)?.value;
    let ok = false;
    if (token) {
      try {
        await jwtVerify(token, SECRET);
        ok = true;
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/superadmin/:path*", "/api/platform/:path*"],
};
