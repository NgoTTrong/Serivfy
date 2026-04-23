import { NextRequest, NextResponse } from "next/server";
import { findOrCreateSessionForTable } from "@/lib/session-guard";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  // `id` here is the table's qrToken (from /table/[qrToken] URL shape)
  const result = await findOrCreateSessionForTable(params.id);
  if (!result) return NextResponse.json({ error: "TABLE_NOT_FOUND" }, { status: 404 });
  return NextResponse.json({
    sessionToken: result.session.token,
    table: { id: result.table.id, label: result.table.label, number: result.table.number },
  });
}
