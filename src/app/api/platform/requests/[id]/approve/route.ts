import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPlatformSession, audit } from "@/lib/platform-auth";
import { approveSignupRequest } from "@/lib/restaurant-approval";
import type { PlanTier } from "@/lib/plans";

const schema = z
  .object({
    planOverride: z.enum(["TRIAL", "STARTER", "PRO", "ENTERPRISE"]).optional(),
  })
  .optional();

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  // Optionally override the requested plan before approving (superadmin edits).
  if (parsed.data?.planOverride) {
    await prisma.signupRequest.update({
      where: { id: params.id },
      data: { planRequested: parsed.data.planOverride as PlanTier },
    });
  }

  try {
    const result = await approveSignupRequest(params.id, { id: s.sub, name: s.name });
    audit({ id: s.sub, name: s.name }, "RESTAURANT_APPROVED", result.restaurantId, {
      requestId: params.id,
      slug: result.slug,
      adminEmail: result.adminEmail,
      sample: result.sample,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
