import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SECRET = new TextEncoder().encode(
  (process.env.AUTH_SECRET || "dev-secret-change-me") + ":platform"
);
const COOKIE = "servify_platform_session";

export type PlatformSession = {
  sub: string; // PlatformAdmin.id
  name: string;
  email: string;
};

export async function signPlatformSession(payload: PlatformSession): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(SECRET);
}

export async function verifyPlatformToken(token: string): Promise<PlatformSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as PlatformSession;
  } catch {
    return null;
  }
}

export async function getPlatformSession(): Promise<PlatformSession | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  return verifyPlatformToken(token);
}

export async function requirePlatform(): Promise<PlatformSession> {
  const s = await getPlatformSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}

export function platformCookieName() {
  return COOKIE;
}

export async function loginPlatformAdmin(email: string, password: string) {
  const bcrypt = (await import("bcryptjs")).default;
  const admin = await prisma.platformAdmin.findUnique({ where: { email } });
  if (!admin) return null;
  const ok = await bcrypt.compare(password, admin.passwordHash);
  if (!ok) return null;
  return admin;
}

/**
 * Record a platform-admin action for audit trail.
 * Fails silently — auditing should not break the main flow.
 */
export async function audit(
  actor: { id: string; name: string } | null,
  action: string,
  target?: string,
  meta?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: actor ? "PLATFORM_ADMIN" : "SYSTEM",
        actorId: actor?.id ?? "system",
        actorName: actor?.name ?? null,
        action,
        target: target ?? null,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch {
    /* noop */
  }
}
