import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  let staff;
  try {
    staff = await requireRole(["ADMIN"]);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const sessions = await prisma.tableSession.findMany({
    where: {
      restaurantId: staff.restaurantId,
      paidAt: {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lt: new Date(to) } : {}),
        not: null,
      },
    },
    include: {
      table: { select: { label: true, number: true } },
      rounds: {
        include: {
          items: { include: { menuItem: { select: { name: true } } } },
        },
      },
    },
    orderBy: { paidAt: "desc" },
  });

  const rows: string[] = [];
  rows.push(
    [
      "Receipt",
      "Table",
      "Opened",
      "Closed",
      "PaymentMethod",
      "PaidAmount",
      "ItemsSummary",
    ]
      .map(csvEscape)
      .join(","),
  );

  for (const s of sessions) {
    const items = s.rounds.flatMap((r) => r.items);
    const summary = items
      .map((i) => `${i.menuItem.name}×${i.quantity}`)
      .join(" | ");
    rows.push(
      [
        s.receiptNumber ?? s.id,
        s.table.label,
        s.openedAt.toISOString(),
        s.closedAt?.toISOString() ?? "",
        s.paymentMethod ?? "",
        s.paidAmount ?? 0,
        summary,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const csv = "﻿" + rows.join("\n"); // BOM for Excel UTF-8
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="servify-sessions-${Date.now()}.csv"`,
    },
  });
}
