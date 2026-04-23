import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";

export async function GET() {
  const s = await getStaffSession();
  if (!s) return NextResponse.json({ staff: null });
  return NextResponse.json({ staff: s });
}
