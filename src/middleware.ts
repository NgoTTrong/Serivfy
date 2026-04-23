import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PLATFORM_COOKIE = "servify_platform_session";
const SECRET = new TextEncoder().encode(
  (process.env.AUTH_SECRET || "dev-secret-change-me") + ":platform",
);

// Simple in-memory rate limiter per IP. Not durable across restarts or
// multi-instance deploys — use Upstash/Redis for prod if needed.
const BUCKET = new Map<string, { count: number; resetAt: number }>();
const SIGNUP_LIMIT = 5; // requests
const SIGNUP_WINDOW_MS = 60_000; // per minute

function checkRate(key: string) {
  const now = Date.now();
  const entry = BUCKET.get(key);
  if (!entry || entry.resetAt < now) {
    BUCKET.set(key, { count: 1, resetAt: now + SIGNUP_WINDOW_MS });
    return true;
  }
  if (entry.count >= SIGNUP_LIMIT) return false;
  entry.count += 1;
  return true;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Superadmin route guard (except login)
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

  // Signup rate-limit (by IP). Prevents spam from single origin.
  if (pathname === "/api/signup" && req.method === "POST") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (!checkRate(`signup:${ip}`)) {
      return NextResponse.json(
        {
          error: "RATE_LIMITED",
          message: "Bạn đã gửi quá nhiều yêu cầu. Thử lại sau 1 phút.",
        },
        { status: 429 },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/superadmin/:path*", "/api/platform/:path*", "/api/signup"],
};
