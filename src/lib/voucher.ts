import { prisma } from "./prisma";

export type VoucherValidationError =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "TOTAL_LIMIT_REACHED"
  | "MIN_ORDER_NOT_MET"
  | "BAD_CONFIG";

export type VoucherValidation =
  | {
      ok: true;
      voucher: {
        id: string;
        code: string;
        label: string;
        kind: "PERCENT_OFF" | "FIXED_OFF";
        value: number;
      };
      discount: number;
      gross: number;
      net: number;
    }
  | { ok: false; error: VoucherValidationError; message: string };

/**
 * Validate a voucher code against a candidate cart subtotal. Pure function
 * from the DB's point of view — nothing is mutated, safe to call from the
 * preview endpoint without worrying about double-spending.
 */
export async function validateVoucher(params: {
  restaurantId: string;
  code: string;
  gross: number;
}): Promise<VoucherValidation> {
  const voucher = await prisma.voucher.findFirst({
    where: {
      restaurantId: params.restaurantId,
      code: { equals: params.code.trim(), mode: "insensitive" },
    },
  });
  if (!voucher) {
    return { ok: false, error: "NOT_FOUND", message: "Mã không tồn tại" };
  }
  if (!voucher.isActive) {
    return { ok: false, error: "INACTIVE", message: "Mã đã tắt" };
  }
  const now = new Date();
  if (voucher.startAt && voucher.startAt > now) {
    return { ok: false, error: "NOT_STARTED", message: "Mã chưa có hiệu lực" };
  }
  if (voucher.endAt && voucher.endAt < now) {
    return { ok: false, error: "EXPIRED", message: "Mã đã hết hạn" };
  }
  if (voucher.totalLimit != null && voucher.usageCount >= voucher.totalLimit) {
    return {
      ok: false,
      error: "TOTAL_LIMIT_REACHED",
      message: "Mã đã đạt giới hạn sử dụng",
    };
  }
  if (voucher.minOrderVND != null && params.gross < voucher.minOrderVND) {
    return {
      ok: false,
      error: "MIN_ORDER_NOT_MET",
      message: `Đơn tối thiểu ${voucher.minOrderVND.toLocaleString("vi-VN")}đ`,
    };
  }

  let discount = 0;
  if (voucher.kind === "PERCENT_OFF") {
    if (voucher.value < 1 || voucher.value > 100) {
      return { ok: false, error: "BAD_CONFIG", message: "Mã cấu hình sai" };
    }
    discount = Math.floor((params.gross * voucher.value) / 100);
    if (voucher.maxDiscountVND != null && discount > voucher.maxDiscountVND) {
      discount = voucher.maxDiscountVND;
    }
  } else if (voucher.kind === "FIXED_OFF") {
    discount = voucher.value;
  } else {
    return { ok: false, error: "BAD_CONFIG", message: "Loại mã không hỗ trợ" };
  }
  // Never allow negative total.
  if (discount > params.gross) discount = params.gross;

  return {
    ok: true,
    voucher: {
      id: voucher.id,
      code: voucher.code,
      label: voucher.label,
      kind: voucher.kind as "PERCENT_OFF" | "FIXED_OFF",
      value: voucher.value,
    },
    discount,
    gross: params.gross,
    net: params.gross - discount,
  };
}

export async function computeSessionGross(sessionId: string): Promise<number> {
  const rows = await prisma.orderItem.findMany({
    where: { round: { sessionId } },
    select: { priceAtOrder: true, quantity: true },
  });
  return rows.reduce((s, r) => s + r.priceAtOrder * r.quantity, 0);
}
