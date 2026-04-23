import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-change-me");
const COOKIE = "servify_session";

export type StaffSession = {
  sub: string; // staff id
  restaurantId: string;
  role: "ADMIN" | "WAITER" | "KITCHEN";
  name: string;
};

export async function signStaffSession(payload: StaffSession): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(SECRET);
}

export async function verifyStaffToken(token: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as StaffSession;
  } catch {
    return null;
  }
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  return verifyStaffToken(token);
}

export async function requireStaff(): Promise<StaffSession> {
  const s = await getStaffSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}

export async function requireRole(roles: StaffSession["role"][]): Promise<StaffSession> {
  const s = await requireStaff();
  if (!roles.includes(s.role)) throw new Error("FORBIDDEN");
  return s;
}

export function authCookieName() {
  return COOKIE;
}

export type LoginResult =
  | { kind: "ok"; staff: Awaited<ReturnType<typeof prisma.staff.findUnique>> }
  | { kind: "invalid" }
  | { kind: "suspended"; reason: string | null }
  | { kind: "expired" };

export async function loginStaff(email: string, password: string): Promise<LoginResult> {
  const bcrypt = (await import("bcryptjs")).default;
  const staff = await prisma.staff.findUnique({
    where: { email },
    include: {
      restaurant: {
        select: { status: true, suspendReason: true, trialEndsAt: true, planTier: true },
      },
    },
  });
  if (!staff) return { kind: "invalid" };
  const ok = await bcrypt.compare(password, staff.passwordHash);
  if (!ok) return { kind: "invalid" };

  const r = staff.restaurant;
  if (r.status === "SUSPENDED") {
    return { kind: "suspended", reason: r.suspendReason };
  }
  if (r.status === "EXPIRED") {
    return { kind: "expired" };
  }
  // Auto-expire trial if past date
  if (r.planTier === "TRIAL" && r.trialEndsAt && r.trialEndsAt < new Date()) {
    await prisma.restaurant.update({
      where: { id: staff.restaurantId },
      data: { status: "EXPIRED" },
    });
    return { kind: "expired" };
  }
  return { kind: "ok", staff };
}
