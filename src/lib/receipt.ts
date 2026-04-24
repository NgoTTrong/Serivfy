import { prisma } from "./prisma";
import { buildVietQrString } from "./vietqr";

/**
 * Print-job payload builder.
 *
 * We intentionally do NOT render ESC/POS bytes server-side. Vietnamese text
 * requires code page CP1258 which varies per printer brand, and shipping raw
 * bytes couples the server to every supported model. Instead the agent
 * receives a structured JSON document and renders it locally with a native
 * ESC/POS library (`escpos` + `iconv-lite`) that knows the target printer.
 *
 * Versioned payload: bump `version` when fields change so old agents can
 * fall back to a safe rendering path instead of crashing.
 */

export type ReceiptItem = {
  name: string;
  qty: number;
  /** Unit price INCLUDING options. Kitchen tickets omit this. */
  unitPrice?: number;
  subtotal?: number;
  optionsLabel: string | null;
  note: string | null;
};

export type ReceiptPayload = {
  type: "RECEIPT";
  version: 1;
  paperWidth: 58 | 80;
  restaurant: {
    name: string;
    logo: string | null;
    address: string | null;
    phone: string | null;
    taxCode: string | null;
  };
  receiptNumber: string;
  tableLabel: string;
  openedAt: string; // ISO
  closedAt: string; // ISO
  items: Array<Required<Pick<ReceiptItem, "name" | "qty" | "unitPrice" | "subtotal">> & Pick<ReceiptItem, "optionsLabel" | "note">>;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: "CASH" | "BANK_TRANSFER" | "CARD" | null;
  paidAmount: number | null;
  changeAmount: number | null;
  vietQr: string | null;
  footer: string;
};

export type KitchenTicketPayload = {
  type: "KITCHEN_TICKET";
  version: 1;
  paperWidth: 58 | 80;
  stationName: string;
  tableLabel: string;
  roundNumber: number;
  createdAt: string; // ISO
  guestLabel: string | null; // "Khách 2" if multiple guests
  items: Array<Pick<ReceiptItem, "name" | "qty" | "optionsLabel" | "note">>;
};

export type PrintPayload = ReceiptPayload | KitchenTicketPayload;

export async function buildReceiptPayload(sessionId: string, paperWidth: 58 | 80 = 80): Promise<ReceiptPayload | null> {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      restaurant: {
        select: {
          name: true,
          logo: true,
          address: true,
          phone: true,
          taxCode: true,
          bankName: true,
          bankAccountNumber: true,
          bankAccountHolder: true,
        },
      },
      table: { select: { label: true } },
      rounds: {
        orderBy: { roundNumber: "asc" },
        include: {
          items: {
            include: { menuItem: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!session) return null;

  const items: ReceiptPayload["items"] = [];
  let subtotal = 0;
  for (const round of session.rounds) {
    for (const it of round.items) {
      const lineSubtotal = it.priceAtOrder * it.quantity;
      subtotal += lineSubtotal;
      items.push({
        name: it.menuItem.name,
        qty: it.quantity,
        unitPrice: it.priceAtOrder,
        subtotal: lineSubtotal,
        optionsLabel: it.optionsLabel,
        note: it.note,
      });
    }
  }

  const paidAmount = session.paidAmount ?? null;
  const total = subtotal; // discount engine plugs in here later
  const changeAmount =
    session.paymentMethod === "CASH" && paidAmount != null ? Math.max(0, paidAmount - total) : null;

  // VietQR only makes sense for bank transfers when both bank + account are set.
  const wantQr =
    session.paymentMethod !== "CASH" &&
    session.restaurant.bankName &&
    session.restaurant.bankAccountNumber;
  const vietQr = wantQr
    ? buildVietQrString({
        bankCode: session.restaurant.bankName!,
        accountNumber: session.restaurant.bankAccountNumber!,
        amountVND: total,
        description: session.receiptNumber ?? session.id.slice(-8).toUpperCase(),
      })
    : null;

  return {
    type: "RECEIPT",
    version: 1,
    paperWidth,
    restaurant: {
      name: session.restaurant.name,
      logo: session.restaurant.logo,
      address: session.restaurant.address,
      phone: session.restaurant.phone,
      taxCode: session.restaurant.taxCode,
    },
    receiptNumber: session.receiptNumber ?? session.id.slice(-8).toUpperCase(),
    tableLabel: session.table.label,
    openedAt: session.openedAt.toISOString(),
    closedAt: (session.closedAt ?? new Date()).toISOString(),
    items,
    subtotal,
    discount: 0,
    total,
    paymentMethod: (session.paymentMethod as ReceiptPayload["paymentMethod"]) ?? null,
    paidAmount,
    changeAmount,
    vietQr,
    footer: "Cảm ơn quý khách — hẹn gặp lại!",
  };
}

/**
 * Build a kitchen ticket for items in a specific round that belong to a
 * given station. Returns null if no items match (e.g. round has no food,
 * only drinks routed to a different station).
 */
export async function buildKitchenTicketPayload(
  roundId: string,
  stationId: string,
  paperWidth: 58 | 80 = 80,
): Promise<KitchenTicketPayload | null> {
  const round = await prisma.orderRound.findUnique({
    where: { id: roundId },
    include: {
      session: { include: { table: { select: { label: true } } } },
      items: {
        where: { menuItem: { stationId } },
        include: {
          menuItem: { select: { name: true, stationId: true } },
          guest: { select: { nickname: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!round || round.items.length === 0) return null;

  const station = await prisma.station.findUnique({
    where: { id: stationId },
    select: { name: true },
  });
  if (!station) return null;

  // Multi-guest rounds get a guest label on each line for waiter hand-off.
  const guestNames = new Set(
    round.items.map((it) => it.guest?.nickname).filter(Boolean) as string[],
  );
  const guestLabel = guestNames.size > 1 ? Array.from(guestNames).join(" · ") : null;

  return {
    type: "KITCHEN_TICKET",
    version: 1,
    paperWidth,
    stationName: station.name,
    tableLabel: round.session.table.label,
    roundNumber: round.roundNumber,
    createdAt: round.createdAt.toISOString(),
    guestLabel,
    items: round.items.map((it) => ({
      name: it.menuItem.name,
      qty: it.quantity,
      optionsLabel: it.optionsLabel,
      note: it.note,
    })),
  };
}

export function encodePayload(payload: PrintPayload): string {
  // Stored as a plain JSON string in PrintJob.payload. No base64 — Postgres
  // TEXT handles this fine and SQL queries on the field stay inspectable.
  return JSON.stringify(payload);
}
