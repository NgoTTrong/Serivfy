/**
 * VietQR Pro EMVCo QR string builder.
 *
 * NAPAS assigns each Vietnamese bank a 6-digit BIN (e.g. VCB=970436,
 * TCB=970407, MB=970422, ACB=970416). Customers scan the resulting QR in
 * any bank app and the payee account + amount are prefilled.
 *
 * We accept the common short bank code users already enter (VCB / TCB / MB)
 * and map to the NAPAS BIN here so admins don't have to know the number.
 *
 * Spec reference: EMVCo MPM v1.1 + NAPAS VietQR extensions.
 */

const BANK_BIN: Record<string, string> = {
  VCB: "970436", // Vietcombank
  VIETCOMBANK: "970436",
  TCB: "970407", // Techcombank
  TECHCOMBANK: "970407",
  MB: "970422", // MB Bank
  MBBANK: "970422",
  ACB: "970416", // ACB
  VPB: "970432", // VPBank
  VPBANK: "970432",
  TPB: "970423", // TPBank
  TPBANK: "970423",
  BIDV: "970418",
  AGRIBANK: "970405",
  VIETINBANK: "970415",
  CTG: "970415",
  SCB: "970429",
  HDBANK: "970437",
  SHB: "970443",
  OCB: "970448",
  SEABANK: "970440",
  MSB: "970426",
  EXIMBANK: "970431",
  NCB: "970419",
  VIETABANK: "970427",
  SAIGONBANK: "970400",
  BACABANK: "970409",
  PVCOMBANK: "970412",
  OCEANBANK: "970414",
  KIENLONGBANK: "970452",
  LPB: "970449",
  LIENVIETPOSTBANK: "970449",
  CAKE: "546034",
  TIMO: "963388",
  VIETBANK: "970433",
};

function resolveBin(code: string): string | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  if (/^\d{6}$/.test(upper)) return upper; // already a BIN
  return BANK_BIN[upper] ?? null;
}

/** TLV field: 2-digit id + 2-digit length + value. */
function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/** CRC-16/CCITT-FALSE, uppercase hex — required by EMVCo. */
function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type VietQrParams = {
  bankCode: string; // short ("VCB") or BIN ("970436")
  accountNumber: string;
  /** Amount in VND — integer. If null, QR is open-amount (customer types it). */
  amountVND?: number | null;
  description?: string; // note shown in payer app, <= ~25 chars ideally
};

/**
 * Build a VietQR "Pro" string suitable for rendering as a QR on a receipt.
 * Returns null if the bank code can't be mapped — caller falls back to no QR.
 */
export function buildVietQrString(p: VietQrParams): string | null {
  const bin = resolveBin(p.bankCode);
  if (!bin || !p.accountNumber) return null;

  // Merchant Account Info (id 38, NAPAS VietQR)
  // 00: GUID "A000000727"
  // 01: nested payee info {00: BIN, 01: account}
  // 02: service type — "QRIBFTTA" (account) or "QRIBFTTC" (card). Use TA.
  const payeeInfo = tlv("00", bin) + tlv("01", p.accountNumber);
  const merchant =
    tlv("00", "A000000727") + tlv("01", payeeInfo) + tlv("02", "QRIBFTTA");

  const fields: string[] = [];
  fields.push(tlv("00", "01")); // payload format indicator
  // 12 = dynamic (one-time), 11 = static (reusable). Use 12 when amount given.
  fields.push(tlv("01", p.amountVND != null && p.amountVND > 0 ? "12" : "11"));
  fields.push(tlv("38", merchant));
  fields.push(tlv("53", "704")); // transaction currency — VND
  if (p.amountVND != null && p.amountVND > 0) {
    fields.push(tlv("54", String(Math.round(p.amountVND))));
  }
  fields.push(tlv("58", "VN")); // country
  if (p.description) {
    const safe = p.description
      .replace(/[^\x20-\x7EÀ-ỹ]/g, "")
      .slice(0, 70);
    if (safe) fields.push(tlv("62", tlv("08", safe)));
  }

  const base = fields.join("") + "6304"; // CRC placeholder
  return base + crc16(base);
}
