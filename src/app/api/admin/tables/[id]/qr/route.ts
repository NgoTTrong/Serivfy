import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const t = await prisma.table.findUnique({ where: { id: params.id } });
  if (!t || t.restaurantId !== staff.restaurantId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const base = process.env.NEXT_PUBLIC_APP_URL || `${req.nextUrl.origin}`;
  const url = `${base}/table/${t.qrToken}`;

  const format = req.nextUrl.searchParams.get("format") || "png";
  if (format === "svg") {
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 512 });
    return new NextResponse(svg, {
      headers: { "Content-Type": "image/svg+xml" },
    });
  }
  const buf = await QRCode.toBuffer(url, { type: "png", margin: 1, width: 1024 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${t.label.replace(/\s+/g, "_")}.png"`,
    },
  });
}
