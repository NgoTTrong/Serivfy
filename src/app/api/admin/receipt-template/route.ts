import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { tenantAudit } from "@/lib/tenant-audit";
import { DEFAULT_RECEIPT_TEMPLATE } from "@/lib/receipt";

const schema = z.object({
  headerName: z.string().max(120).nullable().optional(),
  headerTagline: z.string().max(120).nullable().optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  showAddress: z.boolean().optional(),
  showPhone: z.boolean().optional(),
  showTaxCode: z.boolean().optional(),
  showItemOptions: z.boolean().optional(),
  showVietQr: z.boolean().optional(),
  footerText: z.string().max(500).nullable().optional(),
  footerSecondary: z.string().max(500).nullable().optional(),
  fontScale: z.enum(["small", "normal", "large"]).optional(),
  paperWidth: z.union([z.literal(58), z.literal(80)]).optional(),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const row = await prisma.receiptTemplate.findUnique({
    where: { restaurantId: staff.restaurantId },
  });
  const template = row ?? {
    restaurantId: staff.restaurantId,
    ...DEFAULT_RECEIPT_TEMPLATE,
  };
  return NextResponse.json({ template });
}

export async function PUT(req: NextRequest) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "BAD_INPUT" }, { status: 400 });

  // Upsert: default on create, patch on update.
  const template = await prisma.receiptTemplate.upsert({
    where: { restaurantId: staff.restaurantId },
    update: parsed.data,
    create: {
      restaurantId: staff.restaurantId,
      ...DEFAULT_RECEIPT_TEMPLATE,
      ...parsed.data,
    },
  });
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "receipt.template.updated",
  });
  return NextResponse.json({ template });
}
