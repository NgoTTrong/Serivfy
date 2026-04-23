import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { computeBadge, type MemoryBadge } from "@/lib/memory";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const staff = await requireRole(["ADMIN", "WAITER"]);
    if (staff.restaurantId !== params.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const tables = await prisma.table.findMany({
    where: { restaurantId: params.id, isActive: true },
    orderBy: { number: "asc" },
    include: {
      sessions: {
        where: { status: "ACTIVE" },
        include: {
          guests: true,
          rounds: {
            include: { items: true },
          },
        },
      },
    },
  });

  // Collect all guest deviceIds to resolve Memory in 1 query
  const deviceIds = new Set<string>();
  for (const t of tables) {
    for (const s of t.sessions) for (const g of s.guests) deviceIds.add(g.deviceId);
  }
  const devices =
    deviceIds.size > 0
      ? await prisma.customerDevice.findMany({
          where: {
            restaurantId: params.id,
            deviceId: { in: Array.from(deviceIds) },
          },
          select: { deviceId: true, visitCount: true, totalSpent: true, nickname: true },
        })
      : [];
  const byDevice = new Map(devices.map((d) => [d.deviceId, d]));

  const enriched = tables.map((t) => {
    const active = t.sessions[0];
    let pendingCount = 0;
    let totalRounds = 0;
    let revenue = 0;
    let topBadge: MemoryBadge | null = null;
    let topVisit = 0;
    let topSpent = 0;
    let topNickname: string | null = null;
    if (active) {
      totalRounds = active.rounds.length;
      for (const r of active.rounds) {
        for (const i of r.items) {
          revenue += i.priceAtOrder * i.quantity;
          if (r.status === "IN_KITCHEN" || i.servedQty < i.quantity) {
            pendingCount += i.quantity - i.servedQty;
          }
        }
      }
      // Find most-loyal device at this table (highest visitCount)
      for (const g of active.guests) {
        const d = byDevice.get(g.deviceId);
        if (!d) continue;
        if (d.visitCount > topVisit) {
          topVisit = d.visitCount;
          topBadge = computeBadge(d.visitCount);
          topSpent = d.totalSpent;
          topNickname = d.nickname ?? g.nickname ?? null;
        }
      }
    }
    return {
      id: t.id,
      number: t.number,
      label: t.label,
      capacity: t.capacity,
      qrToken: t.qrToken,
      activeSession: active
        ? {
            id: active.id,
            token: active.token,
            openedAt: active.openedAt,
            guestCount: active.guests.length,
            pendingCount,
            totalRounds,
            revenue,
            billRequestedAt: active.billRequestedAt,
            memory:
              topBadge && topVisit >= 2
                ? {
                    badge: topBadge,
                    visitCount: topVisit,
                    totalSpent: topSpent,
                    nickname: topNickname,
                  }
                : null,
          }
        : null,
    };
  });

  return NextResponse.json({ tables: enriched });
}
