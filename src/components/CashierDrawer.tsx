"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatVND } from "@/lib/format";
import { useDialog } from "./DialogProvider";

type Line = {
  orderItemIds: string[];
  guestIds: (string | null)[];
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  note: string | null;
  optionsLabel: string | null;
  subtotal: number;
};

type Guest = { id: string; nickname: string | null };

type BillDetails = {
  session: {
    id: string;
    token: string;
    status: "ACTIVE" | "CLOSED";
    openedAt: string;
    closedAt: string | null;
    paymentMethod: "CASH" | "BANK_TRANSFER" | "CARD" | null;
    paidAmount: number | null;
    paidAt: string | null;
    receiptNumber: string | null;
  };
  restaurant: {
    id: string;
    name: string;
    address: string | null;
    phone: string | null;
    taxCode: string | null;
    bankName: string | null;
    bankAccountNumber: string | null;
    bankAccountHolder: string | null;
  };
  table: { label: string; number: number };
  guests: Guest[];
  lines: Line[];
  rawItems: RawItem[];
  subtotal: number;
  total: number;
};

type RawItem = {
  id: string;
  menuItemId: string;
  name: string;
  guestId: string | null;
  guestNickname: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  optionsLabel: string | null;
  note: string | null;
};

type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD";

export function CashierDrawer({
  sessionToken,
  tableId,
  tableLabel,
  pendingCount,
  onClose,
  onClosed,
}: {
  sessionToken: string;
  tableId: string;
  tableLabel: string;
  pendingCount: number;
  onClose: () => void;
  onClosed: () => void;
}) {
  const dialog = useDialog();
  const [bill, setBill] = useState<BillDetails | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [splitMode, setSplitMode] = useState<"NONE" | "BY_GUEST" | "EVEN_N">("NONE");
  const [evenN, setEvenN] = useState<number>(2);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/session/${sessionToken}/bill-details`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setBill(d);
        setCashReceived(String(d.total ?? 0));
      });
    return () => {
      alive = false;
    };
  }, [sessionToken]);

  const total = bill?.total ?? 0;
  const cashNum = Math.max(0, Number(cashReceived || 0));
  const change = Math.max(0, cashNum - total);
  const cashShort = method === "CASH" && cashNum < total;

  const vietQrUrl = useMemo(() => {
    if (!bill?.restaurant.bankName || !bill?.restaurant.bankAccountNumber) return null;
    const acc = bill.restaurant.bankAccountNumber;
    const bank = bill.restaurant.bankName;
    const desc = encodeURIComponent(
      `Servify ${bill.table.label} ${bill.session.receiptNumber ?? ""}`.trim()
    );
    const holder = encodeURIComponent(bill.restaurant.bankAccountHolder ?? "");
    return `https://img.vietqr.io/image/${bank}-${acc}-compact2.png?amount=${total}&addInfo=${desc}&accountName=${holder}`;
  }, [bill, total]);

  function printReceipt() {
    if (!receiptRef.current) return;
    const html = receiptRef.current.innerHTML;
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) {
      dialog.toast({ message: "Trình duyệt chặn popup — cho phép rồi thử lại", type: "error" });
      return;
    }
    w.document.write(`<!DOCTYPE html><html><head><title>Hoá đơn ${bill?.session.receiptNumber ?? ""}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: "Be Vietnam Pro", system-ui, sans-serif; margin: 0; padding: 20px; color: #1a1815; }
        .print-wrap { max-width: 80mm; margin: 0 auto; font-size: 12px; line-height: 1.5; }
        .print-wrap h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
        .print-wrap h2 { font-size: 13px; margin: 0 0 2px; text-align: center; }
        .muted { color: #6b6257; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 2px 0; vertical-align: top; }
        .row { display: flex; justify-content: space-between; }
        .divider { border-top: 1px dashed #aaa; margin: 8px 0; }
        .total-row { font-size: 14px; font-weight: 700; }
        .qty { width: 28px; text-align: right; padding-right: 6px; }
        .price { text-align: right; white-space: nowrap; }
        .name { padding-right: 6px; }
        .foot { text-align: center; margin-top: 10px; font-size: 11px; }
        @page { size: auto; margin: 8mm; }
      </style>
    </head><body onload="window.print(); setTimeout(()=>window.close(), 400);">
      <div class="print-wrap">${html}</div>
    </body></html>`);
    w.document.close();
  }

  async function confirmPay() {
    if (!bill) return;
    if (busy) return;
    if (method === "CASH" && cashShort) {
      await dialog.alert({
        icon: "⚠️",
        title: "Chưa đủ tiền",
        message: `Khách đưa ${formatVND(cashNum)} — còn thiếu ${formatVND(total - cashNum)}.`,
        tone: "danger",
      });
      return;
    }

    const ok = await dialog.confirm({
      icon: "🧾",
      title: `Xác nhận thanh toán ${formatVND(total)}?`,
      message: `${tableLabel} · ${
        method === "CASH" ? "Tiền mặt" : method === "BANK_TRANSFER" ? "Chuyển khoản" : "Thẻ"
      }${pendingCount > 0 ? ` · còn ${pendingCount} món chưa phục vụ!` : ""}`,
      confirmLabel: "Thanh toán & đóng bàn",
      cancelLabel: "Quay lại",
      danger: pendingCount > 0,
    });
    if (!ok) return;

    setBusy(true);
    const r = await fetch(`/api/table/${tableId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod: method,
        paidAmount: method === "CASH" ? cashNum : total,
      }),
    });
    setBusy(false);
    if (!r.ok) {
      dialog.toast({ message: "Không đóng được bàn — thử lại", type: "error" });
      return;
    }
    dialog.toast({ message: `${tableLabel} đã thanh toán`, type: "success" });
    onClosed();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-3xl bg-white text-ink-950 shadow-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-brand-600">
              Thu ngân
            </div>
            <h2 className="font-display text-2xl font-bold">{tableLabel}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-white hover:bg-ink-700"
          >
            ✕
          </button>
        </div>

        {!bill ? (
          <div className="flex-1 p-10 text-center text-ink-500">Đang tải hoá đơn...</div>
        ) : (
          <div className="grid flex-1 overflow-hidden md:grid-cols-[1.2fr_1fr]">
            {/* Bill preview (printable) */}
            <div className="overflow-y-auto border-b border-ink-100 bg-ink-50 p-5 md:border-b-0 md:border-r">
              <div
                ref={receiptRef}
                className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow"
              >
                <h1 className="text-center font-display text-xl font-bold">
                  {bill.restaurant.name}
                </h1>
                {bill.restaurant.address && (
                  <p className="muted mt-1 text-center text-xs text-ink-500">
                    {bill.restaurant.address}
                  </p>
                )}
                {bill.restaurant.phone && (
                  <p className="muted text-center text-xs text-ink-500">
                    ĐT: {bill.restaurant.phone}
                    {bill.restaurant.taxCode && ` · MST: ${bill.restaurant.taxCode}`}
                  </p>
                )}
                <h2 className="mt-4 text-center font-display text-base font-bold">
                  HOÁ ĐƠN THANH TOÁN
                </h2>
                <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
                  <span>{bill.table.label}</span>
                  <span>{new Date().toLocaleString("vi-VN")}</span>
                </div>
                {bill.session.receiptNumber && (
                  <div className="text-xs text-ink-500">
                    Số HĐ: <span className="font-mono">{bill.session.receiptNumber}</span>
                  </div>
                )}

                <div className="divider my-3 border-t border-dashed border-ink-300" />

                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-ink-500">
                      <th className="text-left font-medium">Món</th>
                      <th className="qty w-12 text-right font-medium">SL</th>
                      <th className="price text-right font-medium">Tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.lines.map((l, i) => (
                      <tr key={`${l.menuItemId}-${i}`}>
                        <td className="name py-1">
                          {l.name}
                          {l.optionsLabel && (
                            <div className="text-[10px] text-ink-600">→ {l.optionsLabel}</div>
                          )}
                          {l.note && (
                            <div className="text-[10px] italic text-ink-500">· {l.note}</div>
                          )}
                          <div className="text-[10px] text-ink-400">
                            {formatVND(l.unitPrice)}
                          </div>
                        </td>
                        <td className="qty text-right align-top">{l.quantity}</td>
                        <td className="price text-right align-top font-medium">
                          {formatVND(l.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="divider my-3 border-t border-dashed border-ink-300" />

                <div className="row flex items-baseline justify-between">
                  <span className="text-ink-600">Tạm tính</span>
                  <span className="font-medium">{formatVND(bill.subtotal)}</span>
                </div>
                <div className="row total-row mt-2 flex items-baseline justify-between font-display text-xl font-bold">
                  <span>TỔNG</span>
                  <span>{formatVND(bill.total)}</span>
                </div>

                {method === "CASH" && cashNum >= total && cashNum > 0 && (
                  <>
                    <div className="row mt-2 flex items-baseline justify-between text-sm">
                      <span className="text-ink-600">Tiền khách đưa</span>
                      <span>{formatVND(cashNum)}</span>
                    </div>
                    <div className="row flex items-baseline justify-between text-sm">
                      <span className="text-ink-600">Tiền thừa</span>
                      <span className="font-semibold text-green-700">
                        {formatVND(change)}
                      </span>
                    </div>
                  </>
                )}

                <div className="row mt-2 flex items-baseline justify-between text-sm text-ink-600">
                  <span>Hình thức</span>
                  <span>
                    {method === "CASH"
                      ? "Tiền mặt"
                      : method === "BANK_TRANSFER"
                        ? "Chuyển khoản"
                        : "Thẻ"}
                  </span>
                </div>

                <div className="foot mt-5 text-center text-xs text-ink-500">
                  Cảm ơn quý khách! Hẹn gặp lại 🙏
                </div>
                <div className="foot mt-1 text-center text-[10px] text-ink-400">
                  Powered by Servify
                </div>
              </div>
            </div>

            {/* Controls panel */}
            <div className="flex flex-col overflow-y-auto bg-white p-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                  Phương thức thanh toán
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MethodButton
                    active={method === "CASH"}
                    onClick={() => setMethod("CASH")}
                    icon="💵"
                    label="Tiền mặt"
                  />
                  <MethodButton
                    active={method === "BANK_TRANSFER"}
                    onClick={() => setMethod("BANK_TRANSFER")}
                    icon="📱"
                    label="Chuyển khoản"
                  />
                  <MethodButton
                    active={method === "CARD"}
                    onClick={() => setMethod("CARD")}
                    icon="💳"
                    label="Thẻ"
                  />
                </div>
              </div>

              {method === "CASH" && (
                <div className="mt-5">
                  <label className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                    Tiền khách đưa
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-ink-200 bg-white px-5 py-4 text-right font-display text-2xl font-bold outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[total, 100_000, 200_000, 500_000].map((v, i) => (
                      <button
                        key={i}
                        onClick={() => setCashReceived(String(v))}
                        className="rounded-full bg-ink-100 px-3 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-200"
                      >
                        {formatVND(v)}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <SummaryTile label="Tổng bill" value={formatVND(total)} />
                    <SummaryTile
                      label={cashShort ? "Còn thiếu" : "Tiền thừa"}
                      value={formatVND(cashShort ? total - cashNum : change)}
                      tone={cashShort ? "danger" : "success"}
                    />
                  </div>
                </div>
              )}

              {method === "BANK_TRANSFER" && (
                <div className="mt-5">
                  <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                    Quét mã VietQR để chuyển khoản
                  </div>
                  {vietQrUrl ? (
                    <div className="mt-3 rounded-2xl border border-ink-100 bg-ink-50 p-4">
                      <img
                        src={vietQrUrl}
                        alt="VietQR"
                        className="mx-auto aspect-square w-full max-w-[280px] rounded-xl bg-white"
                      />
                      <div className="mt-3 space-y-1 text-sm text-ink-700">
                        <div className="flex justify-between">
                          <span className="text-ink-500">Ngân hàng</span>
                          <span className="font-semibold">{bill.restaurant.bankName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-500">Số TK</span>
                          <span className="font-mono font-semibold">
                            {bill.restaurant.bankAccountNumber}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-500">Chủ TK</span>
                          <span className="font-semibold">
                            {bill.restaurant.bankAccountHolder}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-ink-500">Số tiền</span>
                          <span className="font-display font-bold text-brand-700">
                            {formatVND(total)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                      Chưa có thông tin ngân hàng. Vào <span className="font-semibold">Admin →
                      Cài đặt</span> để thêm TK ngân hàng trước khi nhận chuyển khoản.
                    </div>
                  )}
                </div>
              )}

              {method === "CARD" && (
                <div className="mt-5 rounded-2xl bg-ink-50 p-5 text-sm text-ink-700">
                  <div className="font-semibold">Thanh toán qua máy POS</div>
                  <div className="mt-1 text-ink-500">
                    Quẹt thẻ qua máy POS của quán. Sau khi giao dịch thành công → bấm xác nhận
                    dưới đây.
                  </div>
                  <div className="mt-4">
                    <SummaryTile label="Tổng bill" value={formatVND(total)} />
                  </div>
                </div>
              )}

              {/* Split bill section */}
              <div className="mt-5 rounded-2xl border border-ink-200 bg-ink-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                      Chia hoá đơn
                    </div>
                    <div className="text-[11px] text-ink-600">
                      In nhiều hoá đơn nhỏ cho khách cùng bàn
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {(
                      [
                        { v: "NONE", label: "Không" },
                        { v: "BY_GUEST", label: "Theo người" },
                        { v: "EVEN_N", label: "Chia đều" },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.v}
                        onClick={() => setSplitMode(o.v)}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          splitMode === o.v
                            ? "bg-brand-600 text-white"
                            : "bg-white text-ink-700 ring-1 ring-ink-200"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {splitMode === "EVEN_N" && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <span className="text-ink-600">Chia cho</span>
                    <input
                      type="number"
                      min={2}
                      max={20}
                      value={evenN}
                      onChange={(e) =>
                        setEvenN(Math.max(2, Math.min(20, Number(e.target.value) || 2)))
                      }
                      className="w-16 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-center font-semibold"
                    />
                    <span className="text-ink-600">người</span>
                    <span className="ml-auto text-xs text-ink-500">
                      ≈ {formatVND(Math.ceil(total / evenN))}/người
                    </span>
                  </div>
                )}

                {splitMode !== "NONE" && (
                  <div className="mt-3 space-y-1.5">
                    {computeSplit(bill, splitMode, evenN).map((s, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{s.label}</span>
                        <span className="font-bold text-brand-700">
                          {formatVND(s.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {splitMode !== "NONE" && (
                  <button
                    onClick={() => printSplitReceipts(bill, splitMode, evenN, dialog)}
                    className="mt-3 w-full rounded-xl bg-ink-900 py-2.5 text-sm font-semibold text-white hover:bg-ink-700"
                  >
                    🖨️ In {computeSplit(bill, splitMode, evenN).length} hoá đơn
                  </button>
                )}
              </div>

              <div className="mt-auto pt-6">
                <div className="flex gap-2">
                  <button
                    onClick={printReceipt}
                    className="flex-1 rounded-xl border border-ink-300 bg-white px-4 py-3 text-sm font-semibold hover:bg-ink-50"
                  >
                    🖨️ In hoá đơn
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 rounded-xl bg-ink-100 px-4 py-3 text-sm font-semibold text-ink-700 hover:bg-ink-200"
                  >
                    Để sau
                  </button>
                </div>
                <button
                  onClick={confirmPay}
                  disabled={busy || (method === "CASH" && cashShort)}
                  className="mt-2 w-full rounded-2xl bg-brand-600 py-4 text-base font-bold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:bg-ink-300 disabled:shadow-none"
                >
                  {busy ? "Đang xử lý..." : `Thanh toán ${formatVND(total)}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MethodButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-3 py-4 text-sm font-semibold transition ${
        active
          ? "border-brand-500 bg-brand-50 text-brand-700 shadow-md shadow-brand-200/50"
          : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        tone === "danger"
          ? "bg-red-50 text-red-700"
          : tone === "success"
            ? "bg-green-50 text-green-700"
            : "bg-ink-50 text-ink-700"
      }`}
    >
      <div className="text-[10px] uppercase tracking-widest opacity-75">{label}</div>
      <div className="font-display text-xl font-bold">{value}</div>
    </div>
  );
}

/**
 * Compute per-bill splits.
 * BY_GUEST: each registered guest gets subtotal of items they ordered.
 * Items with no guestId get bucketed into "Bàn chung" so they are not lost.
 * EVEN_N: total evenly divided N ways. Last bill absorbs rounding delta.
 */
type SplitRow = { label: string; amount: number; items: RawItem[] };

function computeSplit(
  bill: BillDetails | null,
  mode: "NONE" | "BY_GUEST" | "EVEN_N",
  n: number,
): SplitRow[] {
  if (!bill || mode === "NONE") return [];
  if (mode === "BY_GUEST") {
    const byGuest = new Map<string, SplitRow>();
    for (const it of bill.rawItems) {
      const key = it.guestId ?? "SHARED";
      const label =
        it.guestNickname ?? (it.guestId ? "Khách" : "Bàn chung (không ai nhận)");
      const row = byGuest.get(key) ?? { label, amount: 0, items: [] };
      row.amount += it.subtotal;
      row.items.push(it);
      byGuest.set(key, row);
    }
    return Array.from(byGuest.values()).filter((r) => r.amount > 0);
  }
  // EVEN_N
  const per = Math.floor(bill.total / n);
  const remainder = bill.total - per * n;
  const rows: SplitRow[] = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      label: `Người ${i + 1}`,
      amount: i === n - 1 ? per + remainder : per,
      items: [],
    });
  }
  return rows;
}

function printSplitReceipts(
  bill: BillDetails | null,
  mode: "NONE" | "BY_GUEST" | "EVEN_N",
  n: number,
  dialog: ReturnType<typeof useDialog>,
) {
  if (!bill) return;
  const splits = computeSplit(bill, mode, n);
  if (splits.length === 0) return;

  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) {
    dialog.toast({
      message: "Trình duyệt chặn popup — cho phép rồi thử lại",
      type: "error",
    });
    return;
  }

  const receipts = splits
    .map((s, idx) => {
      const hasItems = s.items.length > 0;
      const itemRows = hasItems
        ? s.items
            .map(
              (it) => `
          <tr>
            <td class="name">
              ${escape(it.name)}
              ${it.optionsLabel ? `<div class="muted">→ ${escape(it.optionsLabel)}</div>` : ""}
              ${it.note ? `<div class="muted">· ${escape(it.note)}</div>` : ""}
              <div class="muted">${formatVNDPlain(it.unitPrice)}</div>
            </td>
            <td class="qty">${it.quantity}</td>
            <td class="price">${formatVNDPlain(it.subtotal)}</td>
          </tr>`,
            )
            .join("")
        : "";

      return `
      <div class="print-wrap">
        <h1>${escape(bill.restaurant.name)}</h1>
        ${bill.restaurant.address ? `<p class="muted center">${escape(bill.restaurant.address)}</p>` : ""}
        ${bill.restaurant.phone ? `<p class="muted center">ĐT: ${escape(bill.restaurant.phone)}${bill.restaurant.taxCode ? " · MST: " + escape(bill.restaurant.taxCode) : ""}</p>` : ""}
        <h2>HOÁ ĐƠN CHIA ${idx + 1}/${splits.length}</h2>
        <div class="row"><span>${escape(bill.table.label)}</span><span>${new Date().toLocaleString("vi-VN")}</span></div>
        <div class="row"><span>Phần:</span><span><b>${escape(s.label)}</b></span></div>
        <div class="divider"></div>
        ${
          hasItems
            ? `<table><thead><tr><th class="tl">Món</th><th class="tr">SL</th><th class="tr">Tiền</th></tr></thead><tbody>${itemRows}</tbody></table>`
            : `<div class="muted center">Chia đều — phần ${idx + 1}/${splits.length}</div>`
        }
        <div class="divider"></div>
        <div class="row total-row"><span>Phải trả</span><span>${formatVNDPlain(s.amount)}</span></div>
        <div class="foot">Cảm ơn quý khách! 🙏</div>
        <div class="foot-tiny">Powered by Servify</div>
      </div>
      ${idx < splits.length - 1 ? '<div style="page-break-after:always"></div>' : ""}
    `;
    })
    .join("");

  w.document.write(`<!DOCTYPE html><html><head><title>Chia hoá đơn</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: "Be Vietnam Pro", system-ui, sans-serif; margin: 0; padding: 20px; color: #1a1815; }
      .print-wrap { max-width: 80mm; margin: 0 auto 24px; font-size: 12px; line-height: 1.5; }
      h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
      h2 { font-size: 13px; margin: 8px 0 2px; text-align: center; }
      .muted { color: #6b6257; font-size: 11px; }
      .center { text-align: center; }
      table { width: 100%; border-collapse: collapse; }
      td, th { padding: 2px 0; vertical-align: top; font-weight: normal; }
      .tl { text-align: left; }
      .tr { text-align: right; }
      .row { display: flex; justify-content: space-between; }
      .divider { border-top: 1px dashed #aaa; margin: 8px 0; }
      .total-row { font-size: 14px; font-weight: 700; margin-top: 4px; }
      .qty { width: 28px; text-align: right; padding-right: 6px; }
      .price { text-align: right; white-space: nowrap; }
      .name { padding-right: 6px; }
      .foot { text-align: center; margin-top: 10px; font-size: 11px; }
      .foot-tiny { text-align: center; margin-top: 2px; font-size: 9px; color: #888; }
      @page { size: auto; margin: 8mm; }
    </style>
  </head><body onload="window.print(); setTimeout(()=>window.close(), 400);">
    ${receipts}
  </body></html>`);
  w.document.close();
}

function formatVNDPlain(n: number): string {
  return `${n.toLocaleString("en-US")}đ`;
}
function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
