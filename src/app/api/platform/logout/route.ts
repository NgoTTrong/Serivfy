import { NextResponse } from "next/server";
import { platformCookieName } from "@/lib/platform-auth";
import { authCookieName } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Clear platform session + any lingering impersonation
  res.cookies.set(platformCookieName(), "", { path: "/", maxAge: 0 });
  res.cookies.set(authCookieName(), "", { path: "/", maxAge: 0 });
  res.cookies.set("servify_impersonating", "", { path: "/", maxAge: 0 });
  return res;
}
