import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStaffSession } from "@/lib/auth";
import { getActiveSessionByToken } from "@/lib/session-guard";
import { readPulse, type PulseScope } from "@/lib/pulse";

export const dynamic = "force-dynamic";

const ALLOWED: Record<string, PulseScope> = {
  kitchen: "kitchen",
  tables: "tables",
  menu: "menu",
  customer: "customer",
};

/**
 * Cheap "anything-changed?" probe. Clients poll this with `If-None-Match`
 * set to the last version they saw; the server returns 304 without a body
 * when nothing moved, keeping DB reads to one tiny indexed lookup per poll.
 *
 * Access rules:
 *  - kitchen/tables/menu scopes require an authenticated staff session
 *    bound to this restaurant.
 *  - customer scope additionally accepts a valid session token belonging to
 *    this restaurant (so in-dining customer screens can subscribe without
 *    staff credentials).
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const scopeParam = req.nextUrl.searchParams.get("scope") ?? "";
  const scope = ALLOWED[scopeParam];
  if (!scope) {
    return NextResponse.json({ error: "BAD_SCOPE" }, { status: 400 });
  }

  let authorized = false;
  if (scope === "customer") {
    const token = req.nextUrl.searchParams.get("token");
    if (token) {
      const session = await getActiveSessionByToken(token);
      if (session && session.restaurantId === params.id) authorized = true;
    }
  }
  if (!authorized) {
    const staff = await getStaffSession();
    if (staff && staff.restaurantId === params.id) authorized = true;
  }
  if (!authorized) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // Confirm restaurant exists (cheap; helps catch stale client IDs).
  const exists = await prisma.restaurant.count({ where: { id: params.id } });
  if (!exists) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const v = await readPulse(params.id, scope);
  const etag = `W/"${scope}-${v}"`;
  if (req.headers.get("if-none-match") === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json(
    { scope, version: v },
    { headers: { ETag: etag, "Cache-Control": "no-store" } },
  );
}
