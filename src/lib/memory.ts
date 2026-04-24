import { prisma } from "./prisma";

export type MemoryBadge = "NEW" | "RETURNING" | "REGULAR" | "LOYAL" | "VIP";

export function computeBadge(visitCount: number): MemoryBadge {
  if (visitCount <= 1) return "NEW";
  if (visitCount < 3) return "RETURNING";
  if (visitCount < 10) return "REGULAR";
  if (visitCount < 20) return "LOYAL";
  return "VIP";
}

export const BADGE_META: Record<
  MemoryBadge,
  { label: string; icon: string; tone: string; milestone?: string }
> = {
  NEW: { label: "Khách mới", icon: "👋", tone: "bg-ink-100 text-ink-700" },
  RETURNING: {
    label: "Chào trở lại",
    icon: "🎉",
    tone: "bg-amber-100 text-amber-800",
  },
  REGULAR: {
    label: "Khách quen",
    icon: "🔖",
    tone: "bg-blue-100 text-blue-700",
    milestone: "Lần thứ 3 trở lên",
  },
  LOYAL: {
    label: "Khách thân thiết",
    icon: "💛",
    tone: "bg-brand-100 text-brand-700",
    milestone: "Đã ghé 10+ lần",
  },
  VIP: {
    label: "VIP",
    icon: "👑",
    tone: "bg-gradient-to-r from-amber-400 to-brand-500 text-white",
    milestone: "Khách quan trọng của quán",
  },
};

/**
 * Record a device's visit when a guest registers on a session.
 * Upsert the CustomerDevice row, bump visitCount if this is a fresh session
 * (avoid double-count when same device refreshes page).
 */
export async function recordVisit(params: {
  restaurantId: string;
  deviceId: string;
  nickname?: string | null;
  sessionId: string;
}) {
  const existing = await prisma.customerDevice.findUnique({
    where: {
      restaurantId_deviceId: {
        restaurantId: params.restaurantId,
        deviceId: params.deviceId,
      },
    },
  });

  // Count distinct sessions this device has joined at this restaurant.
  // This is our ground truth for visitCount — incrementing naturally when a
  // new Guest row is inserted for a fresh session.
  const sessionCount = await prisma.guest.findMany({
    where: {
      deviceId: params.deviceId,
      session: { restaurantId: params.restaurantId },
    },
    distinct: ["sessionId"],
    select: { sessionId: true },
  });
  const trueVisitCount = sessionCount.length;

  if (!existing) {
    return prisma.customerDevice.create({
      data: {
        restaurantId: params.restaurantId,
        deviceId: params.deviceId,
        nickname: params.nickname ?? null,
        visitCount: Math.max(1, trueVisitCount),
        firstVisit: new Date(),
        lastVisit: new Date(),
      },
    });
  }

  return prisma.customerDevice.update({
    where: { id: existing.id },
    data: {
      nickname: params.nickname ?? existing.nickname,
      visitCount: Math.max(existing.visitCount, trueVisitCount),
      lastVisit: new Date(),
    },
  });
}

/**
 * On session close — attribute paid amount + update favorites.
 * Splits paidAmount proportionally across guests that ordered (by their subtotal)
 * so each customer device gets a share.
 */
export async function settleSessionToMemory(sessionId: string) {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      guests: true,
      rounds: {
        include: {
          items: { select: { guestId: true, menuItemId: true, priceAtOrder: true, quantity: true } },
        },
      },
    },
  });
  if (!session || !session.paidAmount) return;

  const restaurantId = session.restaurantId;
  const flatItems = session.rounds.flatMap((r) => r.items);
  const totalPaid = session.paidAmount;

  // Sum subtotal per guest
  const subtotalByGuest = new Map<string, number>();
  const itemsByGuest = new Map<string, Map<string, number>>();
  let grand = 0;
  for (const it of flatItems) {
    const gid = it.guestId;
    if (!gid) continue;
    const sub = it.priceAtOrder * it.quantity;
    grand += sub;
    subtotalByGuest.set(gid, (subtotalByGuest.get(gid) ?? 0) + sub);
    const m = itemsByGuest.get(gid) ?? new Map();
    m.set(it.menuItemId, (m.get(it.menuItemId) ?? 0) + it.quantity);
    itemsByGuest.set(gid, m);
  }
  if (grand === 0) return;

  // Apply per-device
  for (const guest of session.guests) {
    const guestSubtotal = subtotalByGuest.get(guest.id) ?? 0;
    if (guestSubtotal === 0) continue;
    const attributedPaid = Math.round((guestSubtotal / grand) * totalPaid);

    const device = await prisma.customerDevice.findUnique({
      where: {
        restaurantId_deviceId: {
          restaurantId,
          deviceId: guest.deviceId,
        },
      },
    });
    if (!device) continue;

    // Merge favorites
    const prev: Record<string, number> = device.favoriteJson
      ? JSON.parse(device.favoriteJson)
      : {};
    const guestItems = itemsByGuest.get(guest.id) ?? new Map();
    for (const [menuItemId, qty] of guestItems) {
      prev[menuItemId] = (prev[menuItemId] ?? 0) + qty;
    }

    await prisma.customerDevice.update({
      where: { id: device.id },
      data: {
        totalSpent: device.totalSpent + attributedPaid,
        favoriteJson: JSON.stringify(prev),
        // Remember this session so next visit can show "Lần trước bạn gọi..."
        lastSessionId: sessionId,
      },
    });
  }
}

export async function getMemoryProfile(
  restaurantId: string,
  deviceId: string,
) {
  const device = await prisma.customerDevice.findUnique({
    where: {
      restaurantId_deviceId: { restaurantId, deviceId },
    },
  });
  if (!device || !device.memoryEnabled) return null;

  // Fetch last order items for reorder suggestion
  let lastItems: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    optionsLabel: string | null;
    note: string | null;
  }> = [];
  if (device.lastSessionId) {
    const raw = await prisma.orderItem.findMany({
      where: { round: { sessionId: device.lastSessionId } },
      include: { menuItem: { select: { name: true, isAvailable: true, deletedAt: true } } },
      orderBy: { createdAt: "asc" },
    });
    lastItems = raw
      .filter((it) => it.menuItem.isAvailable && !it.menuItem.deletedAt)
      .map((it) => ({
        menuItemId: it.menuItemId,
        name: it.menuItem.name,
        quantity: it.quantity,
        optionsLabel: it.optionsLabel,
        note: it.note,
      }));
  }

  // Favorite items top 3
  const favCounts: Record<string, number> = device.favoriteJson
    ? JSON.parse(device.favoriteJson)
    : {};
  const topIds = Object.entries(favCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);
  const favMenuItems = topIds.length
    ? await prisma.menuItem.findMany({
        where: { id: { in: topIds }, deletedAt: null },
        select: { id: true, name: true, image: true },
      })
    : [];

  const badge = computeBadge(device.visitCount);

  return {
    deviceId: device.deviceId,
    nickname: device.nickname,
    visitCount: device.visitCount,
    totalSpent: device.totalSpent,
    firstVisit: device.firstVisit,
    lastVisit: device.lastVisit,
    badge,
    lastItems,
    favorites: favMenuItems.map((m) => ({
      ...m,
      qty: favCounts[m.id] ?? 0,
    })),
  };
}
