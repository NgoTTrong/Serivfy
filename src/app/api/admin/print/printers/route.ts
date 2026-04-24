import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  agentId: z.string(),
  name: z.string().min(1).max(60),
  kind: z.enum(["RECEIPT", "KITCHEN", "BAR", "LABEL"]),
  paperWidth: z.union([z.literal(58), z.literal(80)]).default(80),
  usbVendorId: z.number().int().optional().nullable(),
  usbProductId: z.number().int().optional().nullable(),
  networkHost: z.string().max(60).optional().nullable(),
  networkPort: z.number().int().min(1).max(65535).optional().nullable(),
  bluetoothAddr: z.string().max(60).optional().nullable(),
  branchId: z.string().max(60).optional().nullable(),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const printers = await prisma.printer.findMany({
    where: { restaurantId: staff.restaurantId },
    orderBy: { createdAt: "asc" },
    include: {
      agent: { select: { id: true, name: true, lastSeenAt: true } },
    },
  });
  return NextResponse.json({ printers });
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

  const agent = await prisma.printAgent.findUnique({
    where: { id: parsed.data.agentId },
    select: { restaurantId: true, revokedAt: true },
  });
  if (!agent || agent.restaurantId !== staff.restaurantId || agent.revokedAt) {
    return NextResponse.json({ error: "BAD_AGENT" }, { status: 400 });
  }

  // Reject a printer config with no connection method — otherwise the agent
  // wouldn't know how to reach it.
  const d = parsed.data;
  const hasConn = d.usbVendorId != null || d.networkHost != null || d.bluetoothAddr != null;
  if (!hasConn) {
    return NextResponse.json({ error: "NO_CONNECTION" }, { status: 400 });
  }

  const printer = await prisma.printer.create({
    data: {
      restaurantId: staff.restaurantId,
      agentId: d.agentId,
      branchId: d.branchId ?? null,
      name: d.name.trim(),
      kind: d.kind,
      paperWidth: d.paperWidth,
      usbVendorId: d.usbVendorId ?? null,
      usbProductId: d.usbProductId ?? null,
      networkHost: d.networkHost ?? null,
      networkPort: d.networkPort ?? (d.networkHost ? 9100 : null),
      bluetoothAddr: d.bluetoothAddr ?? null,
    },
  });
  return NextResponse.json({ printer });
}
