import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ensureUniqueSlug, approveSignupRequest } from "@/lib/restaurant-approval";
import { audit } from "@/lib/platform-auth";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  restaurantName: z.string().min(2).max(80),
  adminName: z.string().min(2).max(80),
  adminEmail: z.string().email().max(120),
  password: z.string().min(6).max(200),
  phone: z.string().min(6).max(30).optional(),
  address: z.string().max(200).optional(),
  planRequested: z.enum(["TRIAL", "STARTER", "PRO", "ENTERPRISE"]).default("TRIAL"),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const limit = await rateLimit({
    key: `signup:${clientIp(req)}`,
    limit: 5,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: "RATE_LIMITED",
        message: "Bạn đã gửi quá nhiều yêu cầu. Thử lại sau 1 phút.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000)),
          ),
        },
      },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  const d = parsed.data;

  // Email must be globally unique (Staff + pending SignupRequest).
  const [existingStaff, existingReq] = await Promise.all([
    prisma.staff.findUnique({ where: { email: d.adminEmail } }),
    prisma.signupRequest.findUnique({ where: { adminEmail: d.adminEmail } }),
  ]);
  if (existingStaff) {
    return NextResponse.json({ error: "EMAIL_TAKEN" }, { status: 409 });
  }
  if (existingReq && existingReq.status === "PENDING") {
    return NextResponse.json({ error: "REQUEST_PENDING" }, { status: 409 });
  }
  if (existingReq && existingReq.status === "REJECTED") {
    // Allow re-submit after reject — delete old row so we can reuse email
    await prisma.signupRequest.delete({ where: { id: existingReq.id } });
  }

  const slug = await ensureUniqueSlug(d.restaurantName);
  const passwordHash = await bcrypt.hash(d.password, 10);

  const request = await prisma.signupRequest.create({
    data: {
      restaurantName: d.restaurantName.trim(),
      slug,
      adminName: d.adminName.trim(),
      adminEmail: d.adminEmail.toLowerCase(),
      adminPasswordHash: passwordHash,
      phone: d.phone,
      address: d.address,
      planRequested: d.planRequested,
      note: d.note,
    },
  });

  // Auto-approve if platform setting enabled
  const settings = await prisma.platformSettings.findUnique({
    where: { id: "SINGLETON" },
  });
  if (settings?.autoApprove) {
    const result = await approveSignupRequest(request.id, null);
    await audit(null, "RESTAURANT_AUTO_APPROVED", result.restaurantId, {
      requestId: request.id,
      restaurantName: d.restaurantName,
    });
    return NextResponse.json({
      status: "APPROVED",
      restaurantId: result.restaurantId,
      slug,
      message: "Tài khoản đã được kích hoạt — bạn có thể đăng nhập ngay.",
    });
  }

  return NextResponse.json({
    status: "PENDING",
    requestId: request.id,
    slug,
    message: "Đã gửi yêu cầu. Đội ngũ Servify sẽ duyệt trong 1 ngày làm việc.",
  });
}
