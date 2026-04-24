"use client";

import { useCallback, useEffect, useState } from "react";
import { useDialog } from "@/components/DialogProvider";
import { formatVND } from "@/lib/format";

type Totals = {
  sessionsCount: number;
  cashFromSessions: number;
  bankFromSessions: number;
  cardFromSessions: number;
  cashIn: number;
  cashOut: number;
  cashRefund: number;
  expectedCash: number;
  diff: number | null;
};

type Shift = {
  id: string;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCashActual: number | null;
  closingCashExpected: number | null;
  note: string | null;
  closingNote: string | null;
  openedBy: { id: string; name: string };
  closedBy: { id: string; name: string } | null;
};

export default function ShiftsClient() {
  const dialog = useDialog();
  const [current, setCurrent] = useState<{ shift: Shift; totals: Totals } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<Shift[]>([]);
  const [openCashInput, setOpenCashInput] = useState("");
  const [openNote, setOpenNote] = useState("");
  const [openBusy, setOpenBusy] = useState(false);
  const [closeCashInput, setCloseCashInput] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [closeBusy, setCloseBusy] = useState(false);
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNote, setMovementNote] = useState("");

  const load = useCallback(async () => {
    const [c, h] = await Promise.all([
      fetch("/api/admin/shifts/current").then((r) => r.json()),
      fetch("/api/admin/shifts").then((r) => r.json()),
    ]);
    if (c.shift) setCurrent({ shift: c.shift, totals: c.totals });
    else setCurrent(null);
    setHistory(h.shifts || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    // Light polling so the "expected cash" ticker updates as bills close
    // on other devices during the shift.
    const iv = setInterval(load, 10_000);
    return () => clearInterval(iv);
  }, [load]);

  async function openShift() {
    const cash = parseInt(openCashInput.replace(/\D/g, ""), 10);
    if (Number.isNaN(cash) || cash < 0) {
      dialog.toast({ message: "Nhập số tiền đầu ca hợp lệ", type: "error" });
      return;
    }
    setOpenBusy(true);
    try {
      const r = await fetch("/api/admin/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingCash: cash, note: openNote || undefined }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        dialog.toast({
          message:
            d.error === "SHIFT_ALREADY_OPEN"
              ? "Ca khác đã mở — đóng ca cũ trước"
              : "Không mở ca được",
          type: "error",
        });
        return;
      }
      dialog.toast({ message: "Đã mở ca", type: "success" });
      setOpenCashInput("");
      setOpenNote("");
      load();
    } finally {
      setOpenBusy(false);
    }
  }

  async function closeShift() {
    const cash = parseInt(closeCashInput.replace(/\D/g, ""), 10);
    if (Number.isNaN(cash) || cash < 0) {
      dialog.toast({ message: "Nhập tiền mặt đếm được", type: "error" });
      return;
    }
    const ok = await dialog.confirm({
      icon: "🕛",
      title: "Đóng ca?",
      message: `Xác nhận kết ca. Tiền mặt đếm: ${formatVND(cash)}`,
      confirmLabel: "Đóng ca",
    });
    if (!ok) return;
    setCloseBusy(true);
    try {
      const r = await fetch("/api/admin/shifts/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingCashActual: cash,
          closingNote: closeNote || undefined,
        }),
      });
      if (!r.ok) {
        dialog.toast({ message: "Không đóng ca được", type: "error" });
        return;
      }
      dialog.toast({ message: "Đã kết ca", type: "success" });
      setCloseCashInput("");
      setCloseNote("");
      load();
    } finally {
      setCloseBusy(false);
    }
  }

  async function addMovement(kind: "CASH_IN" | "CASH_OUT") {
    const amt = parseInt(movementAmount.replace(/\D/g, ""), 10);
    if (Number.isNaN(amt) || amt <= 0) {
      dialog.toast({ message: "Nhập số tiền hợp lệ", type: "error" });
      return;
    }
    const r = await fetch("/api/admin/shifts/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, amount: amt, note: movementNote || undefined }),
    });
    if (!r.ok) {
      dialog.toast({ message: "Lỗi", type: "error" });
      return;
    }
    dialog.toast({ message: "Đã ghi nhận", type: "success" });
    setMovementAmount("");
    setMovementNote("");
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">Quản lý ca</h1>
        <p className="text-sm text-ink-500">
          Mở ca đầu buổi, kết ca cuối buổi — đối soát tiền mặt. Tính năng tự chọn,
          không bắt buộc.
        </p>
      </div>

      {/* Current shift */}
      <section className="mt-8">
        {!loaded && (
          <div className="h-48 rounded-2xl border border-ink-100 bg-white shimmer" />
        )}

        {loaded && !current && (
          <div className="rounded-2xl border border-ink-100 bg-white p-6">
            <div className="font-display text-lg font-semibold">Chưa có ca mở</div>
            <p className="mt-1 text-sm text-ink-500">
              Mở ca để bắt đầu ghi nhận tiền mặt + giao dịch cuối ngày.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-semibold">Tiền mặt đầu ca (VND)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={openCashInput}
                  onChange={(e) => setOpenCashInput(e.target.value)}
                  placeholder="500000"
                  className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold">Ghi chú</span>
                <input
                  type="text"
                  value={openNote}
                  onChange={(e) => setOpenNote(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
                />
              </label>
            </div>
            <button
              onClick={openShift}
              disabled={openBusy || !openCashInput.trim()}
              className="mt-4 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-ink-300"
            >
              {openBusy ? "..." : "Mở ca"}
            </button>
          </div>
        )}

        {loaded && current && (
          <div className="rounded-2xl border border-brand-200 bg-brand-50/30 p-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-brand-600">
                  Đang mở
                </div>
                <div className="font-display text-2xl font-bold">
                  Ca {new Date(current.shift.openedAt).toLocaleString("vi-VN")}
                </div>
                <div className="text-sm text-ink-600">
                  Mở bởi {current.shift.openedBy.name} · Tiền đầu ca{" "}
                  {formatVND(current.shift.openingCash)}
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Stat label="Phiên thanh toán" value={current.totals.sessionsCount.toString()} />
              <Stat label="Tiền mặt thu" value={formatVND(current.totals.cashFromSessions)} />
              <Stat
                label="Chuyển khoản"
                value={formatVND(current.totals.bankFromSessions)}
              />
              <Stat label="Thẻ" value={formatVND(current.totals.cardFromSessions)} />
              <Stat label="Bổ sung" value={formatVND(current.totals.cashIn)} tone="good" />
              <Stat label="Rút ra" value={formatVND(current.totals.cashOut)} tone="bad" />
              <Stat
                label="Hoàn (tiền mặt)"
                value={formatVND(current.totals.cashRefund)}
                tone="bad"
              />
              <Stat
                label="Tiền mặt kỳ vọng"
                value={formatVND(current.totals.expectedCash)}
                tone="brand"
              />
            </div>

            {/* Manual movement */}
            <div className="mt-6 rounded-xl border border-ink-100 bg-white p-4">
              <div className="font-semibold">Điều chỉnh tiền mặt</div>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <input
                  type="text"
                  inputMode="numeric"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  placeholder="Số tiền"
                  className="rounded-xl border border-ink-200 px-3 py-2 font-mono"
                />
                <input
                  type="text"
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                  placeholder="Ghi chú (VD: mua muối)"
                  className="rounded-xl border border-ink-200 px-3 py-2 md:col-span-2"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => addMovement("CASH_IN")}
                  className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  + Bổ sung
                </button>
                <button
                  onClick={() => addMovement("CASH_OUT")}
                  className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  − Rút ra
                </button>
              </div>
            </div>

            {/* Close shift */}
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="font-semibold">Kết ca</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={closeCashInput}
                  onChange={(e) => setCloseCashInput(e.target.value)}
                  placeholder="Tiền mặt đếm được (VND)"
                  className="rounded-xl border border-ink-200 px-3 py-2 font-mono"
                />
                <input
                  type="text"
                  value={closeNote}
                  onChange={(e) => setCloseNote(e.target.value)}
                  placeholder="Ghi chú cuối ca"
                  className="rounded-xl border border-ink-200 px-3 py-2"
                />
              </div>
              <button
                onClick={closeShift}
                disabled={closeBusy || !closeCashInput.trim()}
                className="mt-2 rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:bg-ink-300"
              >
                {closeBusy ? "..." : "Đóng ca"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* History */}
      <section className="mt-10">
        <h2 className="font-display text-lg font-semibold">Lịch sử ca</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2 text-left">Mở</th>
                <th className="px-3 py-2 text-left">Đóng</th>
                <th className="px-3 py-2 text-left">Nhân viên</th>
                <th className="px-3 py-2 text-right">Đầu ca</th>
                <th className="px-3 py-2 text-right">Kỳ vọng</th>
                <th className="px-3 py-2 text-right">Đếm</th>
                <th className="px-3 py-2 text-right">Lệch</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-ink-400">
                    Chưa có ca nào.
                  </td>
                </tr>
              )}
              {history.map((s) => {
                const diff =
                  s.closingCashActual != null && s.closingCashExpected != null
                    ? s.closingCashActual - s.closingCashExpected
                    : null;
                return (
                  <tr key={s.id} className="border-t border-ink-100">
                    <td className="px-3 py-2 text-xs text-ink-600">
                      {new Date(s.openedAt).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-3 py-2 text-xs text-ink-600">
                      {s.closedAt
                        ? new Date(s.closedAt).toLocaleString("vi-VN")
                        : <span className="font-semibold text-emerald-600">đang mở</span>}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {s.openedBy.name}
                      {s.closedBy && s.closedBy.id !== s.openedBy.id
                        ? ` → ${s.closedBy.name}`
                        : ""}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatVND(s.openingCash)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {s.closingCashExpected != null ? formatVND(s.closingCashExpected) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {s.closingCashActual != null ? formatVND(s.closingCashActual) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {diff != null ? (
                        <span
                          className={
                            diff === 0
                              ? "text-ink-600"
                              : diff > 0
                                ? "text-emerald-600"
                                : "text-red-600"
                          }
                        >
                          {diff > 0 ? "+" : ""}
                          {formatVND(diff)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "brand" | "good" | "bad";
}) {
  return (
    <div className="rounded-xl bg-white p-3">
      <div className="text-xs text-ink-500">{label}</div>
      <div
        className={`mt-1 font-display text-lg font-bold ${
          tone === "brand"
            ? "text-brand-700"
            : tone === "good"
              ? "text-emerald-700"
              : tone === "bad"
                ? "text-red-700"
                : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
