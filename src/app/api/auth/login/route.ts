import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loginStaff, signStaffSession, authCookieName } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

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
    role: staff.role as "ADMIN" | "WAITER" | "KITCHEN",
    name: staff.name,
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
