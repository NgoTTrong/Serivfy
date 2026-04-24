import { prisma } from "./prisma";

/**
 * Extract the Servify receipt number from a bank transaction description.
 * Format emitted by receipts: `SVF-YYYYMMDD-XXXX`. Case-insensitive because
 * some banks uppercase / strip punctuation on the memo field.
 */
export function extractReceiptNumber(desc: string): string | null {
  // Accept `-`, `_`, whitespace, or no separator between the three parts.
  // Many banks rewrite dashes as spaces in SMS-derived descriptions.
  // Suffix allows 4–6 alphanumerics to match both legacy (4) and widened (6)
  // receipt formats.
  const m = /SVF[\s\-_]?(\d{8})[\s\-_]?([A-Z0-9]{4,6})/i.exec(desc);
  if (!m) return null;
  return `SVF-${m[1]}-${m[2].toUpperCase()}`;
}

/** Exact match preferred; fall back to ±1000 VND tolerance on the amount. */
export async function matchTransactionToSession(params: {
  restaurantId: string;
  amount: number;
  description: string;
}) {
  const receiptNumber = extractReceiptNumber(params.description);
  if (!receiptNumber) {
    return { status: "UNMATCHED" as const, sessionId: null as string | null };
  }
  const session = await prisma.tableSession.findFirst({
    where: {
      restaurantId: params.restaurantId,
      receiptNumber,
    },
  });
  if (!session) {
    return { status: "UNMATCHED" as const, sessionId: null };
  }
  // Compare against either the bill total (gross-discount) or a previously
  // recorded paidAmount. We query aggregated order items if paidAmount is null
  // (session not yet closed when the transfer arrived, common for TRANSFER).
  let expected = session.paidAmount;
  if (expected == null) {
    const agg = await prisma.orderItem.aggregate({
      where: { round: { sessionId: session.id } },
      _sum: { priceAtOrder: true, quantity: true },
    });
    // Quick gross estimate: sum(priceAtOrder*qty). Not exact because Prisma
    // doesn't support scalar math inside _sum, but close enough for fuzzy
    // matching — exact verification happens in matchStatus==AMBIGUOUS.
    const itemRows = await prisma.orderItem.findMany({
      where: { round: { sessionId: session.id } },
      select: { priceAtOrder: true, quantity: true },
    });
    const gross = itemRows.reduce((s, r) => s + r.priceAtOrder * r.quantity, 0);
    expected = Math.max(0, gross - session.discountAmount);
    void agg;
  }

  const diff = Math.abs(params.amount - expected);
  if (diff === 0) {
    return { status: "MATCHED" as const, sessionId: session.id };
  }
  if (diff <= 1000) {
    // Small tolerance — bank might deduct 1000đ SMS fee on some accounts.
    return { status: "MATCHED" as const, sessionId: session.id };
  }
  return { status: "AMBIGUOUS" as const, sessionId: session.id };
}
