import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getPlatformSession, audit } from "@/lib/platform-auth";

const schema = z.object({
  autoApprove: z.boolean(),
});

export async function GET() {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const settings = await prisma.platformSettings.upsert({
    where: { id: "SINGLETON" },
    create: { id: "SINGLETON", autoApprove: false },
    update: {},
  });
  return NextResponse.json({ settings });
}

export async function PATCH(req: NextRequest) {
  const s = await getPlatformSession();
  if (!s) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const settings = await prisma.platformSettings.upsert({
    where: { id: "SINGLETON" },
    create: { id: "SINGLETON", autoApprove: parsed.data.autoApprove },
    update: { autoApprove: parsed.data.autoApprove },
  });
  audit({ id: s.sub, name: s.name }, "SETTINGS_UPDATED", undefined, parsed.data);
  return NextResponse.json({ settings });
}
