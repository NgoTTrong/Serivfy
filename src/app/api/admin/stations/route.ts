import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).max(60),
  order: z.number().int().optional(),
  printerId: z.string().nullable().optional(),
  branchId: z.string().max(60).optional().nullable(),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const stations = await prisma.station.findMany({
    where: { restaurantId: staff.restaurantId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    include: {
      printer: { select: { id: true, name: true, kind: true } },
      _count: { select: { menuItems: true } },
    },
  });
  return NextResponse.json({ stations });
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

  if (parsed.data.printerId) {
    const printer = await prisma.printer.findUnique({
      where: { id: parsed.data.printerId },
      select: { restaurantId: true },
    });
    if (!printer || printer.restaurantId !== staff.restaurantId) {
      return NextResponse.json({ error: "BAD_PRINTER" }, { status: 400 });
    }
  }

  const station = await prisma.station.create({
    data: {
      restaurantId: staff.restaurantId,
      name: parsed.data.name.trim(),
      order: parsed.data.order ?? 0,
      printerId: parsed.data.printerId ?? null,
      branchId: parsed.data.branchId ?? null,
    },
  });
  return NextResponse.json({ station });
}
