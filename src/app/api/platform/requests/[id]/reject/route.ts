import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPlatformSession, audit } from "@/lib/platform-auth";
import { rejectSignupRequest } from "@/lib/restaurant-approval";

const schema = z.object({
  reason: z.string().min(2).max(500),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  await rejectSignupRequest(params.id, parsed.data.reason, { id: s.sub, name: s.name });
  audit({ id: s.sub, name: s.name }, "RESTAURANT_REJECTED", params.id, {
    reason: parsed.data.reason,
  });
  return NextResponse.json({ ok: true });
}
