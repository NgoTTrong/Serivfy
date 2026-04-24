import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { tenantAudit } from "@/lib/tenant-audit";

const schema = z.object({
  action: z.enum(["rotate", "disable"]),
});

/**
 * Manage the Casso webhook secret. Admin either:
 *   - rotate  → generate a new random token and return it once
 *   - disable → clear the secret and refuse future webhook posts
 *
 * The token is intentionally never displayed again after creation. Admins
 * who lose it can rotate a new one; Casso must then be reconfigured.
 */
export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const r = await prisma.restaurant.findUnique({
    where: { id: staff.restaurantId },
    select: { cassoWebhookSecret: true },
  });
  return NextResponse.json({
    enabled: !!r?.cassoWebhookSecret,
    webhookUrl: `/api/webhooks/casso/${staff.restaurantId}`,
  });
}

export async function POST(req: NextRequest) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  if (parsed.data.action === "disable") {
    await prisma.restaurant.update({
      where: { id: staff.restaurantId },
      data: { cassoWebhookSecret: null },
    });
    tenantAudit({
      restaurantId: staff.restaurantId,
      actor: { id: staff.sub, name: staff.name },
      action: "casso.disabled",
    });
    return NextResponse.json({ enabled: false });
  }

  const token = crypto.randomBytes(24).toString("base64url");
  await prisma.restaurant.update({
    where: { id: staff.restaurantId },
    data: { cassoWebhookSecret: token },
  });
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "casso.rotated",
  });
  return NextResponse.json({
    enabled: true,
    token, // returned once, never again
    webhookUrl: `/api/webhooks/casso/${staff.restaurantId}`,
  });
}
