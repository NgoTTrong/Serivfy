import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loginStaff, signStaffSession, authCookieName } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  // Throttle by both IP and email so a single attacker can't brute-force one
  // account from rotating IPs, and a flaky user doesn't lock out the whole IP.
  const ip = clientIp(req);
  const emailKey = parsed.data.email.toLowerCase();
  const [ipBucket, emailBucket] = await Promise.all([
    rateLimit({ key: `login:ip:${ip}`, limit: 20, windowMs: 60_000 }),
    rateLimit({ key: `login:email:${emailKey}`, limit: 10, windowMs: 60_000 }),
  ]);
  if (!ipBucket.allowed || !emailBucket.allowed) {
    const resetAt = ipBucket.allowed ? emailBucket.resetAt : ipBucket.resetAt;
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Quá nhiều lần thử. Đợi 1 phút rồi thử lại." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

  const result = await loginStaff(parsed.data.email, parsed.data.password);
  if (result.kind === "invalid") {
    return NextResponse.json({ error: "INVALID" }, { status: 401 });
  }
  if (result.kind === "suspended") {
    return NextResponse.json(
      {
        error: "SUSPENDED",
        message:
          result.reason ||
          "Tài khoản quán đã bị tạm đình chỉ. Vui lòng liên hệ hỗ trợ: hi@servify.vn",
      },
      { status: 403 }
    );
  }
  if (result.kind === "expired") {
    return NextResponse.json(
      {
        error: "EXPIRED",
        message:
          "Bản dùng thử đã hết hạn. Liên hệ hi@servify.vn để nâng cấp tiếp tục sử dụng.",
      },
      { status: 403 }
    );
  }

  const staff = result.staff!;
  const token = await signStaffSession({
    sub: staff.id,
    restaurantId: staff.restaurantId,
    role: staff.role,
    name: staff.name,
    branchId: staff.branchId,
    sv: staff.tokenVersion,
    rv: staff.restaurantTokenVersion,
  });

  const res = NextResponse.json({
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      restaurantId: staff.restaurantId,
    },
  });
  res.cookies.set(authCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
