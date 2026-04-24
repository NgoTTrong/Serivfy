import { prisma } from "./prisma";
import {
  buildReceiptPayload,
  buildKitchenTicketPayload,
  encodePayload,
} from "./receipt";

/**
 * Enqueue PrintJob rows. These are best-effort from the caller's point of
 * view — if nothing is configured (no stations, no printers, no active
 * agent) we silently skip so the underlying mutation (order submit, bill
 * close) never fails on printing alone.
 */

export async function enqueueKitchenTickets(roundId: string): Promise<number> {
  const round = await prisma.orderRound.findUnique({
    where: { id: roundId },
    include: {
      session: { select: { restaurantId: true } },
      items: {
        include: { menuItem: { select: { stationId: true } } },
      },
    },
  });
  if (!round) return 0;

  // Group: station → has at least one item in this round
  const stationIds = new Set<string>();
  for (const it of round.items) {
    if (it.menuItem.stationId) stationIds.add(it.menuItem.stationId);
  }
  if (stationIds.size === 0) return 0;

  // Load station → printer mapping in one query. Only active printers with
  // a valid agent are considered.
  const stations = await prisma.station.findMany({
    where: {
      id: { in: Array.from(stationIds) },
      restaurantId: round.session.restaurantId,
      printerId: { not: null },
    },
    include: {
      printer: {
        select: { id: true, paperWidth: true, isActive: true, agentId: true },
      },
    },
  });

  let created = 0;
  for (const s of stations) {
    if (!s.printer || !s.printer.isActive) continue;
    const payload = await buildKitchenTicketPayload(
      roundId,
      s.id,
      (s.printer.paperWidth === 58 ? 58 : 80) as 58 | 80,
    );
    if (!payload) continue;
    await prisma.printJob.create({
      data: {
        restaurantId: round.session.restaurantId,
        printerId: s.printer.id,
        kind: "KITCHEN_TICKET",
        payload: encodePayload(payload),
        roundId,
        sessionId: round.sessionId,
      },
    });
    created++;
  }
  return created;
}

export async function enqueueReceipt(sessionId: string): Promise<boolean> {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { restaurantId: true },
  });
  if (!session) return false;

  // Pick any active RECEIPT-kind printer in the tenant. Multi-branch will
  // later thread TableSession.branchId through to narrow the lookup; for now
  // single-branch installs pick the first receipt printer created.
  const printer = await prisma.printer.findFirst({
    where: {
      restaurantId: session.restaurantId,
      kind: "RECEIPT",
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });
  if (!printer) return false;

  const payload = await buildReceiptPayload(
    sessionId,
    printer.paperWidth === 58 ? 58 : 80,
  );
  if (!payload) return false;

  await prisma.printJob.create({
    data: {
      restaurantId: session.restaurantId,
      printerId: printer.id,
      kind: "RECEIPT",
      payload: encodePayload(payload),
      sessionId,
    },
  });
  return true;
}
