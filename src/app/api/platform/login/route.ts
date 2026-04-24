import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  loginPlatformAdmin,
  signPlatformSession,
  platformCookieName,
  audit,
} from "@/lib/platform-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  // Platform admin surface is extra sensitive — tighter limits.
  const ip = clientIp(req);
  const emailKey = parsed.data.email.toLowerCase();
  const [ipBucket, emailBucket] = await Promise.all([
    rateLimit({ key: `plogin:ip:${ip}`, limit: 10, windowMs: 60_000 }),
    rateLimit({ key: `plogin:email:${emailKey}`, limit: 5, windowMs: 60_000 }),
  ]);
  if (!ipBucket.allowed || !emailBucket.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED" },
      { status: 429 },
    );
  }

  const admin = await loginPlatformAdmin(parsed.data.email, parsed.data.password);
  if (!admin) return NextResponse.json({ error: "INVALID" }, { status: 401 });

  const token = await signPlatformSession({
    sub: admin.id,
    name: admin.name,
    email: admin.email,
  });
  const res = NextResponse.json({
    admin: { id: admin.id, name: admin.name, email: admin.email },
  });
  res.cookies.set(platformCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  audit({ id: admin.id, name: admin.name }, "PLATFORM_LOGIN");
  return res;
}
