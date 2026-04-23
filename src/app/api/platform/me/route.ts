import { NextResponse } from "next/server";
import { getPlatformSession } from "@/lib/platform-auth";

export async function GET() {
  const s = await getPlatformSession();
  return NextResponse.json({ admin: s ?? null });
}
