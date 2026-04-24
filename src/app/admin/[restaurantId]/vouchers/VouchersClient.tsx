"use client";

import { useCallback, useEffect, useState } from "react";
import { useDialog } from "@/components/DialogProvider";
import { Select } from "@/components/Select";
import { formatVND } from "@/lib/format";

type Voucher = {
  id: string;
  code: string;
  label: string;
  kind: "PERCENT_OFF" | "FIXED_OFF";
  value: number;
  minOrderVND: number | null;
  maxDiscountVND: number | null;
  startAt: string | null;
  endAt: string | null;
  totalLimit: number | null;
  usageCount: number;
  isActive: boolean;
};

export default function VouchersClient() {
  const dialog = useDialog();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Voucher | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/vouchers");
    if (r.ok) setVouchers((await r.json()).vouchers || []);
    setLoaded(true);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(v: Voucher) {
    await fetch(`/api/admin/vouchers/${v.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !v.isActive }),
    });
    load();
  }

  async function remove(v: Voucher) {
    const ok = await dialog.confirm({
      icon: "🗑️",
      title: `Xoá mã "${v.code}"?`,
      message:
        v.usageCount > 0
          ? "Mã đã được dùng — sẽ chỉ tạm tắt, không xoá hẳn."
          : "Xoá mã vĩnh viễn?",
      confirmLabel: "OK",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/vouchers/${v.id}`, { method: "DELETE" });
    dialog.toast({ message: "Đã xử lý", type: "success" });
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">
            Mã khuyến mại
          </h1>
          <p className="text-sm text-ink-500">
            Tạo voucher % hoặc giảm tiền — áp dụng tại màn thu ngân.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Thêm mã
        </button>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {!loaded &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl border border-ink-100 bg-white shimmer" />
          ))}
        {loaded && vouchers.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-ink-200 p-10 text-center text-ink-500">
            Chưa có mã. Thêm mã đầu tiên.
          </div>
        )}
        {vouchers.map((v) => (
          <div
            key={v.id}
            className={`rounded-2xl border bg-white p-4 ${
              v.isActive ? "border-ink-100" : "border-ink-200 bg-ink-50 opacity-75"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-lg font-bold tracking-wide">{v.code}</div>
                <div className="text-sm text-ink-600">{v.label}</div>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  v.kind === "PERCENT_OFF"
                    ? "bg-brand-100 text-brand-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {v.kind === "PERCENT_OFF" ? `${v.value}%` : `-${formatVND(v.value)}`}
              </span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-ink-600">
              {v.minOrderVND != null && (
                <div>Đơn tối thiểu: {formatVND(v.minOrderVND)}</div>
              )}
              {v.maxDiscountVND != null && (
                <div>Giảm tối đa: {formatVND(v.maxDiscountVND)}</div>
              )}
              {v.totalLimit != null && (
                <div>
                  Đã dùng {v.usageCount}/{v.totalLimit}
                </div>
              )}
              {v.endAt && <div>Hết hạn: {new Date(v.endAt).toLocaleDateString("vi-VN")}</div>}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => setEditing(v)}
                className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              >
                Sửa
              </button>
              <button
                onClick={() => toggleActive(v)}
                className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              >
                {v.isActive ? "Tắt" : "Bật"}
              </button>
              <button
                onClick={() => remove(v)}
                className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700"
              >
                Xoá
              </button>
            </div>
          </div>
        ))}
      </div>

      {(showNew || editing) && (
        <VoucherDialog
          voucher={editing}
          onClose={() => {
            setShowNew(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowNew(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function VoucherDialog({
  voucher,
  onClose,
  onSaved,
}: {
  voucher: Voucher | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useDialog();
  const [code, setCode] = useState(voucher?.code ?? "");
  const [label, setLabel] = useState(voucher?.label ?? "");
  const [kind, setKind] = useState<"PERCENT_OFF" | "FIXED_OFF">(
    voucher?.kind ?? "PERCENT_OFF",
  );
  const [value, setValue] = useState<string>(String(voucher?.value ?? ""));
  const [minOrder, setMinOrder] = useState<string>(
    voucher?.minOrderVND ? String(voucher.minOrderVND) : "",
  );
  const [maxDiscount, setMaxDiscount] = useState<string>(
    voucher?.maxDiscountVND ? String(voucher.maxDiscountVND) : "",
  );
  const [endAt, setEndAt] = useState<string>(
    voucher?.endAt ? voucher.endAt.slice(0, 10) : "",
  );
  const [totalLimit, setTotalLimit] = useState<string>(
    voucher?.totalLimit ? String(voucher.totalLimit) : "",
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    const v = parseInt(value, 10);
    if (Number.isNaN(v) || v <= 0) {
      dialog.toast({ message: "Nhập giá trị hợp lệ", type: "error" });
      return;
    }
    if (kind === "PERCENT_OFF" && v > 100) {
      dialog.toast({ message: "Phần trăm 1-100", type: "error" });
      return;
    }
    setBusy(true);
    const toNum = (s: string) => {
      const n = parseInt(s.replace(/\D/g, ""), 10);
      return Number.isNaN(n) ? null : n;
    };
    const body = {
      code: code.toUpperCase(),
      label,
      kind,
      value: v,
      minOrderVND: minOrder ? toNum(minOrder) : null,
      maxDiscountVND: kind === "PERCENT_OFF" && maxDiscount ? toNum(maxDiscount) : null,
      endAt: endAt ? new Date(endAt + "T23:59:59").toISOString() : null,
      totalLimit: totalLimit ? toNum(totalLimit) : null,
    };
    try {
      const r = voucher
        ? await fetch(`/api/admin/vouchers/${voucher.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...body, code: undefined, kind: undefined }),
          })
        : await fetch("/api/admin/vouchers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        dialog.toast({
          message: d.error === "CODE_TAKEN" ? "Mã đã tồn tại" : "Lỗi lưu",
          type: "error",
        });
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="font-display text-xl font-bold">
          {voucher ? "Sửa mã" : "Mã khuyến mại mới"}
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-semibold">Mã</span>
            <input
              type="text"
              disabled={!!voucher}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="SUMMER20"
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono tracking-wider disabled:bg-ink-50"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Tên gọi</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Giảm 20% hè"
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-semibold">Loại</span>
              <Select
                value={kind}
                onChange={(v) => setKind(v as "PERCENT_OFF" | "FIXED_OFF")}
                options={[
                  { value: "PERCENT_OFF", label: "% Giảm" },
                  { value: "FIXED_OFF", label: "Giảm tiền" },
                ]}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">
                {kind === "PERCENT_OFF" ? "% Giảm (1-100)" : "VND giảm"}
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-semibold">Đơn tối thiểu (tùy chọn)</span>
              <input
                type="text"
                inputMode="numeric"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
              />
            </label>
            {kind === "PERCENT_OFF" && (
              <label className="block text-sm">
                <span className="font-semibold">Giảm tối đa (tùy chọn)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxDiscount}
                  onChange={(e) => setMaxDiscount(e.target.value.replace(/\D/g, ""))}
                  className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
                />
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-semibold">Hết hạn (tùy chọn)</span>
              <input
                type="date"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Số lượt tối đa (tùy chọn)</span>
              <input
                type="text"
                inputMode="numeric"
                value={totalLimit}
                onChange={(e) => setTotalLimit(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
              />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Huỷ
          </button>
          <button
            onClick={save}
            disabled={busy || !code.trim() || !label.trim() || !value.trim()}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-ink-300"
          >
            {busy ? "..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
