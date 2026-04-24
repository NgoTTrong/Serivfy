import { prisma } from "./prisma";

/**
 * Fetch the single OPEN shift for a restaurant, if any. Branch-aware: when
 * `branchId` is provided we scope by it, otherwise we pick the tenant-wide
 * open shift (single-branch installs).
 */
export async function getOpenShift(restaurantId: string, branchId: string | null = null) {
  return prisma.shift.findFirst({
    where: {
      restaurantId,
      status: "OPEN",
      branchId: branchId ?? null,
    },
  });
}

/**
 * Sum a shift's movements to compute the cash drawer's expected balance.
 *   expected = opening
 *            + cash sessions
 *            + cash ins
 *            - cash outs
 *            - cash refunds
 * Non-cash movements (bank transfer / card) are tracked separately.
 */
export async function computeShiftTotals(shiftId: string) {
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { movements: true },
  });
  if (!shift) return null;

  let cashFromSessions = 0;
  let bankFromSessions = 0;
  let cardFromSessions = 0;
  let cashIn = 0;
  let cashOut = 0;
  let cashRefund = 0;
  let sessionsCount = 0;

  for (const m of shift.movements) {
    if (m.kind === "SESSION_CLOSED") {
      sessionsCount += 1;
      if (m.paymentMethod === "CASH") cashFromSessions += m.amount;
      else if (m.paymentMethod === "BANK_TRANSFER") bankFromSessions += m.amount;
      else if (m.paymentMethod === "CARD") cardFromSessions += m.amount;
    } else if (m.kind === "CASH_IN") {
      cashIn += m.amount;
    } else if (m.kind === "CASH_OUT") {
      cashOut += m.amount;
    } else if (m.kind === "REFUND" && m.paymentMethod === "CASH") {
      cashRefund += m.amount;
    }
  }

  const expectedCash =
    shift.openingCash + cashFromSessions + cashIn - cashOut - cashRefund;
  const diff =
    shift.closingCashActual != null ? shift.closingCashActual - expectedCash : null;

  return {
    shift,
    sessionsCount,
    cashFromSessions,
    bankFromSessions,
    cardFromSessions,
    cashIn,
    cashOut,
    cashRefund,
    expectedCash,
    diff,
  };
}

/**
 * Record a session closure against the currently open shift (if any).
 * Silently no-ops when no shift is open — the feature is opt-in per
 * restaurant, and we don't want to block close-bill on an unopened shift.
 */
export async function recordSessionMovement(params: {
  restaurantId: string;
  branchId?: string | null;
  sessionId: string;
  amount: number;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CARD";
  staffId: string;
}): Promise<void> {
  const open = await getOpenShift(params.restaurantId, params.branchId ?? null);
  if (!open) return;
  await prisma.shiftMovement.create({
    data: {
      shiftId: open.id,
      kind: "SESSION_CLOSED",
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      sessionId: params.sessionId,
      createdByStaffId: params.staffId,
    },
  });
}
