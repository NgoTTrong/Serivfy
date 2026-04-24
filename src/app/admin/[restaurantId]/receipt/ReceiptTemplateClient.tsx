"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDialog } from "@/components/DialogProvider";
import { Select } from "@/components/Select";
import { formatVND } from "@/lib/format";

type Template = {
  headerName: string | null;
  headerTagline: string | null;
  logoUrl: string | null;
  showAddress: boolean;
  showPhone: boolean;
  showTaxCode: boolean;
  showItemOptions: boolean;
  showVietQr: boolean;
  footerText: string | null;
  footerSecondary: string | null;
  fontScale: string;
  paperWidth: number;
};

const SAMPLE = {
  restaurantName: "Quán Bà Nội",
  restaurantAddress: "123 Phan Chu Trinh, Q.1, TP.HCM",
  restaurantPhone: "0901 234 567",
  restaurantTaxCode: "0123456789",
  receiptNumber: "SVF-20260424-ABCDEF",
  tableLabel: "Bàn 3",
  openedAt: new Date(Date.now() - 45 * 60_000),
  closedAt: new Date(),
  items: [
    { name: "Phở bò tái", qty: 1, unitPrice: 75_000, subtotal: 75_000, optionsLabel: "Tô lớn, thêm trứng", note: null },
    { name: "Bún chả Hà Nội", qty: 2, unitPrice: 70_000, subtotal: 140_000, optionsLabel: null, note: "ít rau" },
    { name: "Trà đá", qty: 3, unitPrice: 5_000, subtotal: 15_000, optionsLabel: null, note: null },
  ],
  subtotal: 230_000,
  discount: 20_000,
  total: 210_000,
  paymentMethod: "BANK_TRANSFER" as const,
  paidAmount: 210_000,
  changeAmount: 0,
};

export default function ReceiptTemplateClient() {
  const dialog = useDialog();
  const [tpl, setTpl] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/receipt-template");
    if (r.ok) {
      const d = await r.json();
      setTpl(d.template);
      setDirty(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  function update<K extends keyof Template>(k: K, v: Template[K]) {
    setTpl((prev) => (prev ? { ...prev, [k]: v } : prev));
    setDirty(true);
  }

  async function save() {
    if (!tpl || busy) return;
    setBusy(true);
    const r = await fetch("/api/admin/receipt-template", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tpl),
    });
    setBusy(false);
    if (!r.ok) {
      dialog.toast({ message: "Lỗi lưu", type: "error" });
      return;
    }
    dialog.toast({ message: "Đã lưu mẫu hoá đơn", type: "success" });
    setDirty(false);
  }

  if (!tpl) return <div className="p-6 text-ink-500">Đang tải...</div>;

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">
            Mẫu hoá đơn
          </h1>
          <p className="text-sm text-ink-500">
            Tuỳ chỉnh nội dung hoá đơn in cho khách. Xem trước trực tiếp bên phải.
          </p>
        </div>
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          {busy ? "Đang lưu..." : dirty ? "Lưu mẫu" : "Chưa có thay đổi"}
        </button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="space-y-5 lg:col-span-3">
          <Section title="Giấy in">
            <div className="flex gap-2">
              {[80, 58].map((w) => (
                <button
                  key={w}
                  onClick={() => update("paperWidth", w)}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                    tpl.paperWidth === w
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-ink-200 hover:bg-ink-50"
                  }`}
                >
                  {w}mm{" "}
                  <span className="text-xs font-normal text-ink-500">
                    ({w === 80 ? "K80 phổ biến" : "K58 mini"})
                  </span>
                </button>
              ))}
            </div>
            <label className="mt-3 block text-sm">
              <span className="font-semibold">Cỡ chữ</span>
              <Select
                value={tpl.fontScale}
                onChange={(v) => update("fontScale", v)}
                options={[
                  { value: "small", label: "Nhỏ (tiết kiệm giấy)" },
                  { value: "normal", label: "Vừa" },
                  { value: "large", label: "To (dễ đọc)" },
                ]}
              />
            </label>
          </Section>

          <Section title="Đầu hoá đơn">
            <label className="block text-sm">
              <span className="font-semibold">Tên hiển thị (bỏ trống = tên quán)</span>
              <input
                value={tpl.headerName ?? ""}
                onChange={(e) => update("headerName", e.target.value || null)}
                placeholder={SAMPLE.restaurantName}
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-semibold">Dòng slogan (tuỳ chọn)</span>
              <input
                value={tpl.headerTagline ?? ""}
                onChange={(e) => update("headerTagline", e.target.value || null)}
                placeholder="Quét. Chọn. Thưởng thức."
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-semibold">URL logo (tuỳ chọn)</span>
              <input
                value={tpl.logoUrl ?? ""}
                onChange={(e) => update("logoUrl", e.target.value || null)}
                placeholder="https://..."
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono text-xs"
              />
              <p className="mt-1 text-xs text-ink-500">
                Logo đen-trắng tối ưu cho máy in nhiệt. PNG/JPG ~300×150px.
              </p>
            </label>
          </Section>

          <Section title="Thông tin hiển thị">
            <Toggle
              label="Địa chỉ quán"
              checked={tpl.showAddress}
              onChange={(v) => update("showAddress", v)}
            />
            <Toggle
              label="Số điện thoại"
              checked={tpl.showPhone}
              onChange={(v) => update("showPhone", v)}
            />
            <Toggle
              label="Mã số thuế (MST)"
              checked={tpl.showTaxCode}
              onChange={(v) => update("showTaxCode", v)}
            />
            <Toggle
              label="Tuỳ chọn món (size, topping, ghi chú)"
              checked={tpl.showItemOptions}
              onChange={(v) => update("showItemOptions", v)}
            />
            <Toggle
              label="Mã QR VietQR để chuyển khoản"
              checked={tpl.showVietQr}
              onChange={(v) => update("showVietQr", v)}
            />
          </Section>

          <Section title="Cuối hoá đơn">
            <label className="block text-sm">
              <span className="font-semibold">Dòng cảm ơn</span>
              <input
                value={tpl.footerText ?? ""}
                onChange={(e) => update("footerText", e.target.value || null)}
                placeholder="Cảm ơn quý khách — hẹn gặp lại!"
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
              />
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-semibold">Dòng phụ (wifi, fanpage...)</span>
              <input
                value={tpl.footerSecondary ?? ""}
                onChange={(e) => update("footerSecondary", e.target.value || null)}
                placeholder="Wifi: servify / Pass: xinchao"
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
              />
            </label>
          </Section>
        </div>

        {/* Live preview */}
        <div className="lg:col-span-2">
          <div className="sticky top-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-500">
              Xem trước
            </div>
            <div className="rounded-2xl bg-ink-900 p-4">
              <Preview template={tpl} />
            </div>
            <p className="mt-2 text-xs text-ink-500">
              Dữ liệu mẫu để xem trước. Bill thật sẽ dùng thông tin quán + khách.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5">
      <div className="mb-3 font-display text-lg font-semibold">{title}</div>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-brand-600"
      />
    </label>
  );
}

function Preview({ template }: { template: Template }) {
  const bodyWidthMm = template.paperWidth === 58 ? 52 : 72;
  const baseFontPt =
    template.fontScale === "small" ? 10 : template.fontScale === "large" ? 13 : 11;

  // Render approximately what the thermal receipt looks like. Width in pixels
  // at ~3.78px/mm gives a realistic preview on standard monitors.
  const widthPx = useMemo(() => Math.round(bodyWidthMm * 3.78), [bodyWidthMm]);

  return (
    <div
      className="mx-auto rounded-md bg-white shadow-inner"
      style={{
        width: widthPx,
        padding: "12px 10px",
        fontFamily: "Consolas, Menlo, monospace",
        fontSize: `${baseFontPt}pt`,
        color: "#000",
        lineHeight: 1.35,
      }}
    >
      {template.logoUrl && (
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={template.logoUrl}
            alt=""
            style={{ maxWidth: 100, maxHeight: 60, filter: "grayscale(1) contrast(1.2)" }}
          />
        </div>
      )}
      <div style={{ textAlign: "center", fontWeight: 700, fontSize: `${baseFontPt + 3}pt` }}>
        {template.headerName || SAMPLE.restaurantName}
      </div>
      {template.headerTagline && (
        <div style={{ textAlign: "center", fontSize: `${baseFontPt - 2}pt` }}>
          {template.headerTagline}
        </div>
      )}
      {template.showAddress && (
        <div style={{ textAlign: "center", fontSize: `${baseFontPt - 2}pt` }}>
          {SAMPLE.restaurantAddress}
        </div>
      )}
      {template.showPhone && (
        <div style={{ textAlign: "center", fontSize: `${baseFontPt - 2}pt` }}>
          SĐT: {SAMPLE.restaurantPhone}
        </div>
      )}
      {template.showTaxCode && (
        <div style={{ textAlign: "center", fontSize: `${baseFontPt - 2}pt` }}>
          MST: {SAMPLE.restaurantTaxCode}
        </div>
      )}
      <Divider />
      <div style={{ textAlign: "center", fontWeight: 600 }}>HOÁ ĐƠN THANH TOÁN</div>
      <div style={{ textAlign: "center", fontSize: `${baseFontPt - 2}pt` }}>
        #{SAMPLE.receiptNumber}
      </div>
      <Divider />
      <Row left="Bàn:" right={SAMPLE.tableLabel} small baseFontPt={baseFontPt} />
      <Row
        left="Mở:"
        right={SAMPLE.openedAt.toLocaleString("vi-VN")}
        small
        baseFontPt={baseFontPt}
      />
      <Row
        left="Đóng:"
        right={SAMPLE.closedAt.toLocaleString("vi-VN")}
        small
        baseFontPt={baseFontPt}
      />
      <Divider />
      {SAMPLE.items.map((it, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <Row left={it.name} right={formatVND(it.unitPrice)} baseFontPt={baseFontPt} />
          <Row
            left={`${it.qty} × ${formatVND(it.unitPrice)}`}
            right={formatVND(it.subtotal)}
            small
            baseFontPt={baseFontPt}
          />
          {template.showItemOptions && it.optionsLabel && (
            <div
              style={{ paddingLeft: 10, fontSize: `${baseFontPt - 2}pt`, color: "#333" }}
            >
              + {it.optionsLabel}
            </div>
          )}
          {template.showItemOptions && it.note && (
            <div
              style={{ paddingLeft: 10, fontSize: `${baseFontPt - 2}pt`, color: "#333" }}
            >
              ※ {it.note}
            </div>
          )}
        </div>
      ))}
      <Divider />
      <Row left="Tạm tính" right={formatVND(SAMPLE.subtotal)} baseFontPt={baseFontPt} />
      <Row
        left="Giảm giá"
        right={`-${formatVND(SAMPLE.discount)}`}
        baseFontPt={baseFontPt}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontWeight: 700,
          fontSize: `${baseFontPt + 3}pt`,
          marginTop: 4,
        }}
      >
        <span>TỔNG</span>
        <span>{formatVND(SAMPLE.total)}</span>
      </div>
      <Divider />
      <Row left="PTTT:" right="Chuyển khoản" small baseFontPt={baseFontPt} />
      <Row
        left="Khách trả:"
        right={formatVND(SAMPLE.paidAmount)}
        small
        baseFontPt={baseFontPt}
      />
      {template.showVietQr && (
        <>
          <Divider />
          <div style={{ textAlign: "center", fontSize: `${baseFontPt - 2}pt` }}>
            Quét QR để chuyển khoản
          </div>
          <div style={{ textAlign: "center", marginTop: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div
              style={{
                margin: "0 auto",
                width: 110,
                height: 110,
                background: `repeating-conic-gradient(#000 0 25%, #fff 0 50%) 0 0 / 12px 12px`,
                borderRadius: 4,
              }}
              title="VietQR placeholder — QR thật sinh lúc in"
            />
          </div>
        </>
      )}
      <Divider />
      <div style={{ textAlign: "center", fontSize: `${baseFontPt - 2}pt` }}>
        {template.footerText || "Cảm ơn quý khách — hẹn gặp lại!"}
      </div>
      {template.footerSecondary && (
        <div
          style={{
            textAlign: "center",
            fontSize: `${baseFontPt - 2}pt`,
            marginTop: 2,
          }}
        >
          {template.footerSecondary}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        borderTop: "1px dashed #000",
        margin: "4px 0",
      }}
    />
  );
}

function Row({
  left,
  right,
  small,
  baseFontPt,
}: {
  left: string;
  right: string;
  small?: boolean;
  baseFontPt: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: small ? `${baseFontPt - 2}pt` : `${baseFontPt}pt`,
      }}
    >
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}
