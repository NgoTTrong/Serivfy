import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { tenantAudit } from "@/lib/tenant-audit";

const schema = z.object({
  provider: z.enum(["STUB", "VIETTEL", "VNPT", "MISA", "EASYINVOICE", "HILO"]),
  apiEndpoint: z.string().max(300).nullable().optional(),
  apiUsername: z.string().max(200).nullable().optional(),
  apiPassword: z.string().max(500).nullable().optional(),
  taxCode: z.string().max(30).nullable().optional(),
  templateCode: z.string().max(30).nullable().optional(),
  seriesCode: z.string().max(30).nullable().optional(),
  isEnabled: z.boolean().optional(),
});

export async function GET() {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const cfg = await prisma.eInvoiceConfig.findUnique({
    where: { restaurantId: staff.restaurantId },
    select: {
      provider: true,
      apiEndpoint: true,
      apiUsername: true,
      // Never return apiPassword to the client; only surface whether it's set.
      taxCode: true,
      templateCode: true,
      seriesCode: true,
      isEnabled: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({
    config: cfg
      ? {
          ...cfg,
          hasPassword: Boolean(
            (await prisma.eInvoiceConfig.findUnique({
              where: { restaurantId: staff.restaurantId },
              select: { apiPassword: true },
            }))?.apiPassword,
          ),
        }
      : null,
  });
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

  const d = parsed.data;
  const cfg = await prisma.eInvoiceConfig.upsert({
    where: { restaurantId: staff.restaurantId },
    update: {
      provider: d.provider,
      apiEndpoint: d.apiEndpoint ?? null,
      apiUsername: d.apiUsername ?? null,
      // Only overwrite password when a non-empty one is sent; empty string
      // means "don't change" so admins can edit other fields without
      // retyping credentials.
      ...(d.apiPassword !== undefined && d.apiPassword !== ""
        ? { apiPassword: d.apiPassword }
        : {}),
      taxCode: d.taxCode ?? null,
      templateCode: d.templateCode ?? null,
      seriesCode: d.seriesCode ?? null,
      isEnabled: d.isEnabled ?? false,
    },
    create: {
      restaurantId: staff.restaurantId,
      provider: d.provider,
      apiEndpoint: d.apiEndpoint ?? null,
      apiUsername: d.apiUsername ?? null,
      apiPassword: d.apiPassword ?? null,
      taxCode: d.taxCode ?? null,
      templateCode: d.templateCode ?? null,
      seriesCode: d.seriesCode ?? null,
      isEnabled: d.isEnabled ?? false,
    },
  });
  tenantAudit({
    restaurantId: staff.restaurantId,
    actor: { id: staff.sub, name: staff.name },
    action: "einvoice.config.updated",
    meta: { provider: d.provider, isEnabled: cfg.isEnabled },
  });
  return NextResponse.json({ ok: true });
}
