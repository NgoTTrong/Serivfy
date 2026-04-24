import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1).optional(),
  tagline: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  taxCode: z.string().nullable().optional(),
  bankName: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankAccountHolder: z.string().nullable().optional(),
  timezone: z.string().min(1).max(60).optional(),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const r = await prisma.restaurant.findUnique({
    where: { id: staff.restaurantId },
    select: {
      id: true,
      name: true,
      slug: true,
      tagline: true,
      address: true,
      phone: true,
      taxCode: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
      timezone: true,
    },
  });
  return NextResponse.json({ restaurant: r });
}

export async function PATCH(req: NextRequest) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });
  }
  const r = await prisma.restaurant.update({
    where: { id: staff.restaurantId },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      tagline: true,
      address: true,
      phone: true,
      taxCode: true,
      bankName: true,
      bankAccountNumber: true,
      bankAccountHolder: true,
      timezone: true,
    },
  });
  return NextResponse.json({ restaurant: r });
}
