"use client";

import { useEffect, useState } from "react";
import { useDialog } from "@/components/DialogProvider";
import { Select } from "@/components/Select";

type Restaurant = {
  id: string;
  name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  taxCode: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
};

const BANK_OPTIONS = [
  { code: "VCB", name: "Vietcombank" },
  { code: "TCB", name: "Techcombank" },
  { code: "MB", name: "MBBank" },
  { code: "ACB", name: "ACB" },
  { code: "BIDV", name: "BIDV" },
  { code: "CTG", name: "VietinBank" },
  { code: "VPB", name: "VPBank" },
  { code: "STB", name: "Sacombank" },
  { code: "TPB", name: "TPBank" },
  { code: "SHB", name: "SHB" },
  { code: "VIB", name: "VIB" },
  { code: "OCB", name: "OCB" },
  { code: "MSB", name: "MSB" },
  { code: "HDB", name: "HDBank" },
  { code: "EIB", name: "Eximbank" },
  { code: "SEAB", name: "SeABank" },
  { code: "NAB", name: "Nam A Bank" },
  { code: "ABB", name: "ABBank" },
];

export default function SettingsForm() {
  const dialog = useDialog();
  const [r, setR] = useState<Restaurant | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/restaurant")
      .then((res) => res.json())
      .then((d) => setR(d.restaurant));
  }, []);

  function set<K extends keyof Restaurant>(k: K, v: Restaurant[K]) {
    setR((prev) => (prev ? { ...prev, [k]: v } : prev));
  }

  async function save() {
    if (!r) return;
    setBusy(true);
    const res = await fetch("/api/admin/restaurant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: r.name,
        tagline: r.tagline,
        address: r.address,
        phone: r.phone,
        taxCode: r.taxCode,
        bankName: r.bankName,
        bankAccountNumber: r.bankAccountNumber,
        bankAccountHolder: r.bankAccountHolder,
      }),
    });
    setBusy(false);
    if (res.ok) {
      dialog.toast({ message: "Đã lưu cài đặt", type: "success" });
    } else {
      dialog.toast({ message: "Không lưu được — thử lại", type: "error" });
    }
  }

  if (!r) {
    return (
      <div className="p-6 md:p-10">
        <div className="h-10 w-64 rounded bg-ink-100 shimmer" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 w-full rounded-2xl bg-ink-100 shimmer" />
          ))}
        </div>
      </div>
    );
  }

  const qrPreview =
    r.bankName && r.bankAccountNumber
      ? `https://img.vietqr.io/image/${r.bankName}-${r.bankAccountNumber}-compact2.png?addInfo=Servify+Demo&accountName=${encodeURIComponent(r.bankAccountHolder ?? "")}`
      : null;

  return (
    <div className="p-6 md:p-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">Cài đặt</h1>
        <p className="text-sm text-ink-500">
          Thông tin quán hiển thị trên hoá đơn + tài khoản nhận chuyển khoản
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Thông tin quán */}
        <div className="rounded-3xl border border-ink-100 bg-white p-6">
          <h2 className="font-display text-xl font-bold">Thông tin quán</h2>
          <p className="text-sm text-ink-500">Hiển thị ở hoá đơn in</p>
          <div className="mt-4 space-y-3">
            <Field label="Tên quán" value={r.name} onChange={(v) => set("name", v)} />
            <Field
              label="Khẩu hiệu"
              value={r.tagline ?? ""}
              onChange={(v) => set("tagline", v || null)}
              placeholder="Hương vị Việt, bữa cơm nhà"
            />
            <Field
              label="Địa chỉ"
              value={r.address ?? ""}
              onChange={(v) => set("address", v || null)}
              placeholder="123 Phan Chu Trinh, Q.1, TP.HCM"
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Điện thoại"
                value={r.phone ?? ""}
                onChange={(v) => set("phone", v || null)}
                placeholder="0901 234 567"
              />
              <Field
                label="Mã số thuế"
                value={r.taxCode ?? ""}
                onChange={(v) => set("taxCode", v || null)}
                placeholder="0123456789"
              />
            </div>
          </div>
        </div>

        {/* Ngân hàng */}
        <div className="rounded-3xl border border-ink-100 bg-white p-6">
          <h2 className="font-display text-xl font-bold">Tài khoản ngân hàng</h2>
          <p className="text-sm text-ink-500">
            Dùng để tạo VietQR ở màn hình thu ngân (chuyển khoản)
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                Ngân hàng
              </label>
              <div className="mt-1">
                <Select
                  value={r.bankName ?? ""}
                  onChange={(v) => set("bankName", v || null)}
                  placeholder="— Chọn ngân hàng —"
                  options={BANK_OPTIONS.map((b) => ({
                    value: b.code,
                    label: b.name,
                    sub: b.code,
                    icon: "🏦",
                  }))}
                />
              </div>
            </div>
            <Field
              label="Số tài khoản"
              value={r.bankAccountNumber ?? ""}
              onChange={(v) => set("bankAccountNumber", v || null)}
              placeholder="1234567890"
            />
            <Field
              label="Chủ tài khoản"
              value={r.bankAccountHolder ?? ""}
              onChange={(v) => set("bankAccountHolder", v || null)}
              placeholder="QUAN BA NOI"
            />
          </div>

          {qrPreview && (
            <div className="mt-5 rounded-2xl bg-ink-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                Xem thử QR
              </div>
              <img
                src={qrPreview}
                alt="QR preview"
                className="mx-auto mt-2 aspect-square w-full max-w-[220px] rounded-xl bg-white"
              />
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 mt-6 flex justify-end gap-2 border-t border-ink-100 bg-white/80 py-4 backdrop-blur">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-full bg-brand-600 px-6 py-3 font-semibold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Đang lưu..." : "Lưu cài đặt"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-widest text-ink-500">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
    </div>
  );
}
