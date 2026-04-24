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
  /** Null for HQ-scoped staff who can see all branches. */
  branchId: string | null;
  /** Staff token version at sign-time; invalidates if Staff.tokenVersion bumps. */
  sv: number;
  /** Restaurant token version at sign-time; invalidates all tenant tokens on bump. */
  rv: number;
};

export async function signStaffSession(payload: StaffSession): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("14d")
    .sign(SECRET);
}

async function decodeStaffToken(token: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as StaffSession;
  } catch {
    return null;
  }
}

// Legacy API kept for any external callers. Does NOT check DB — prefer getStaffSession.
export async function verifyStaffToken(token: string): Promise<StaffSession | null> {
  return decodeStaffToken(token);
}

// ── DB-backed validation with in-memory TTL cache.
// Cache is per-instance; acceptable because worst case a revocation takes TTL
// seconds to propagate across Fluid Compute instances.
type CacheEntry = { expiresAt: number; session: StaffSession | null };
const sessionCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30_000;
const CACHE_MAX = 5_000;

function cacheGet(token: string): CacheEntry | undefined {
  const hit = sessionCache.get(token);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    sessionCache.delete(token);
    return undefined;
  }
  return hit;
}

function cacheSet(token: string, session: StaffSession | null) {
  if (sessionCache.size >= CACHE_MAX) {
    // Drop oldest ~10% when full. Simple FIFO-ish eviction.
    const cutoff = Math.floor(CACHE_MAX * 0.1);
    let i = 0;
    for (const k of sessionCache.keys()) {
      sessionCache.delete(k);
      if (++i >= cutoff) break;
    }
  }
  sessionCache.set(token, { expiresAt: Date.now() + CACHE_TTL_MS, session });
}

export function clearStaffSessionCache() {
  sessionCache.clear();
}

async function validateAgainstDb(parsed: StaffSession): Promise<StaffSession | null> {
  const staff = await prisma.staff.findUnique({
    where: { id: parsed.sub },
    select: {
      id: true,
      isActive: true,
      tokenVersion: true,
      role: true,
      restaurantId: true,
      branchId: true,
      name: true,
      restaurant: {
        select: { status: true, tokenVersion: true, planTier: true, trialEndsAt: true },
      },
    },
  });
  if (!staff || !staff.isActive) return null;
  // Legacy tokens signed before tokenVersion existed omit sv/rv; treat as 0.
  const claimSv = parsed.sv ?? 0;
  const claimRv = parsed.rv ?? 0;
  if (staff.tokenVersion !== claimSv) return null;
  if (staff.restaurant.tokenVersion !== claimRv) return null;
  if (staff.restaurant.status !== "ACTIVE") return null;
  if (
    staff.restaurant.planTier === "TRIAL" &&
    staff.restaurant.trialEndsAt &&
    staff.restaurant.trialEndsAt < new Date()
  ) {
    return null;
  }
  // Return refreshed fields from DB so role/name/restaurantId stay in sync.
  return {
    sub: staff.id,
    restaurantId: staff.restaurantId,
    role: staff.role as StaffSession["role"],
    name: staff.name,
    branchId: staff.branchId ?? null,
    sv: staff.tokenVersion,
    rv: staff.restaurant.tokenVersion,
  };
}

export async function getStaffSession(): Promise<StaffSession | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;

  const cached = cacheGet(token);
  if (cached) return cached.session;

  const parsed = await decodeStaffToken(token);
  if (!parsed) {
    cacheSet(token, null);
    return null;
  }
  const validated = await validateAgainstDb(parsed);
  cacheSet(token, validated);
  return validated;
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

export type LoggedInStaff = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "WAITER" | "KITCHEN";
  restaurantId: string;
  branchId: string | null;
  tokenVersion: number;
  restaurantTokenVersion: number;
};

export type LoginResult =
  | { kind: "ok"; staff: LoggedInStaff }
  | { kind: "invalid" }
  | { kind: "suspended"; reason: string | null }
  | { kind: "expired" };

export async function loginStaff(email: string, password: string): Promise<LoginResult> {
  const bcrypt = (await import("bcryptjs")).default;
  const staff = await prisma.staff.findUnique({
    where: { email },
    include: {
      restaurant: {
        select: { status: true, suspendReason: true, trialEndsAt: true, planTier: true, tokenVersion: true },
      },
    },
  });
  if (!staff || !staff.isActive) return { kind: "invalid" };
  const ok = await bcrypt.compare(password, staff.passwordHash);
  if (!ok) return { kind: "invalid" };

  const r = staff.restaurant;
  if (r.status === "SUSPENDED") {
    return { kind: "suspended", reason: r.suspendReason };
  }
  if (r.status === "EXPIRED") {
    return { kind: "expired" };
  }
  if (r.planTier === "TRIAL" && r.trialEndsAt && r.trialEndsAt < new Date()) {
    await prisma.restaurant.update({
      where: { id: staff.restaurantId },
      data: { status: "EXPIRED" },
    });
    return { kind: "expired" };
  }
  return {
    kind: "ok",
    staff: {
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role as "ADMIN" | "WAITER" | "KITCHEN",
      restaurantId: staff.restaurantId,
      branchId: staff.branchId ?? null,
      tokenVersion: staff.tokenVersion,
      restaurantTokenVersion: r.tokenVersion,
    },
  };
}
