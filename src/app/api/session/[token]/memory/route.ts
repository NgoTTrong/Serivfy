import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getMemoryProfile } from "@/lib/memory";

const schema = z.object({
  deviceId: z.string().min(3),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  const session = await prisma.tableSession.findUnique({
    where: { token: params.token },
    select: { restaurantId: true },
  });
  if (!session) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const profile = await getMemoryProfile(session.restaurantId, parsed.data.deviceId);
  return NextResponse.json({ profile });
}
