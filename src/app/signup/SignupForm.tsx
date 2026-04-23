"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select } from "@/components/Select";

type Result =
  | { status: "APPROVED"; restaurantId: string; slug: string; message: string }
  | { status: "PENDING"; requestId: string; slug: string; message: string };

export default function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    restaurantName: "",
    adminName: "",
    adminEmail: "",
    password: "",
    phone: "",
    address: "",
    planRequested: "TRIAL" as "TRIAL" | "PRO" | "ENTERPRISE",
    note: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (form.password.length < 6) {
      setErr("Mật khẩu tối thiểu 6 ký tự");
      return;
    }
    setBusy(true);
    const r = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      if (d.error === "EMAIL_TAKEN") setErr("Email này đã được dùng.");
      else if (d.error === "REQUEST_PENDING") setErr("Bạn đã có 1 yêu cầu đang chờ duyệt với email này.");
      else setErr("Không gửi được — kiểm tra lại thông tin.");
      return;
    }
    const data = (await r.json()) as Result;
    const qs = new URLSearchParams({
      status: data.status,
      slug: data.slug,
      email: form.adminEmail,
    }).toString();
    router.push(`/signup/success?${qs}`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-100 via-white to-brand-50">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-12 px-6 py-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:px-12">
        {/* Left: marketing */}
        <div className="order-2 lg:order-1">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-ink-950 hover:text-brand-700"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zM14 3h7v7h-7V3zm0 13h3v3h-3v-3zm4 0h3v3h-3v-3zm0 4h3v1h-3v-1z" />
              </svg>
            </span>
            <span className="font-display text-2xl font-bold">Servify</span>
          </Link>
          <h1 className="mt-8 font-display text-4xl font-bold leading-tight text-ink-950 md:text-5xl">
            Mở tài khoản cho quán<br />
            <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">
              trong 60 giây.
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-ink-700">
            Điền form, đội ngũ Servify sẽ kích hoạt tài khoản và gửi thông tin đăng nhập cho bạn trong vòng 1 ngày làm việc. Dùng thử miễn phí 14 ngày — không thẻ tín dụng.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-ink-700">
            {[
              "QR không giới hạn · dán lên bàn là dùng",
              "Bếp nhận đơn realtime — KDS có chuông",
              "Nhân viên tick món qua tablet, không loạn bàn",
              "Thu ngân VietQR tự tạo, in hoá đơn 1 chạm",
            ].map((l) => (
              <li key={l} className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  ✓
                </span>
                {l}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: form card */}
        <form
          onSubmit={submit}
          className="order-1 rounded-3xl border border-ink-100 bg-white p-7 shadow-2xl shadow-brand-300/30 lg:order-2"
        >
          <h2 className="font-display text-2xl font-bold text-ink-950">
            Đăng ký dùng thử
          </h2>
          <p className="mt-1 text-sm text-ink-500">
            Đã có tài khoản?{" "}
            <Link href="/admin/login" className="font-semibold text-brand-700 hover:underline">
              Đăng nhập
            </Link>
          </p>

          <div className="mt-5 space-y-3">
            <Field
              label="Tên quán"
              required
              value={form.restaurantName}
              onChange={(v) => set("restaurantName", v)}
              placeholder="Quán Phở 37"
            />
            <Field
              label="Họ tên chủ quán"
              required
              value={form.adminName}
              onChange={(v) => set("adminName", v)}
              placeholder="Nguyễn Văn A"
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Email đăng nhập"
                type="email"
                required
                value={form.adminEmail}
                onChange={(v) => set("adminEmail", v)}
                placeholder="a@quanphô.vn"
              />
              <Field
                label="Mật khẩu"
                type="password"
                required
                value={form.password}
                onChange={(v) => set("password", v)}
                placeholder="Tối thiểu 6 ký tự"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Điện thoại"
                value={form.phone}
                onChange={(v) => set("phone", v)}
                placeholder="0901 234 567"
              />
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                  Gói mong muốn
                </label>
                <div className="mt-1">
                  <Select
                    value={form.planRequested}
                    onChange={(v) => set("planRequested", v as typeof form.planRequested)}
                    options={[
                      { value: "TRIAL", label: "Dùng thử 14 ngày", icon: "🎁", sub: "Miễn phí" },
                      { value: "PRO", label: "Pro", icon: "⭐", sub: "299,000đ/tháng" },
                      { value: "ENTERPRISE", label: "Enterprise", icon: "🏢", sub: "Chuỗi lớn" },
                    ]}
                  />
                </div>
              </div>
            </div>
            <Field
              label="Địa chỉ quán"
              value={form.address}
              onChange={(v) => set("address", v)}
              placeholder="123 Nguyễn Trãi, Q.5, TP.HCM"
            />
            <Field
              label="Ghi chú (tuỳ chọn)"
              value={form.note}
              onChange={(v) => set("note", v)}
              placeholder="Có bao nhiêu bàn? Cần hỗ trợ gì?"
              as="textarea"
            />
          </div>

          {err && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-2xl bg-brand-600 py-4 text-base font-bold text-white shadow-lg shadow-brand-600/30 transition hover:-translate-y-0.5 hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Đang gửi..." : "Gửi yêu cầu đăng ký →"}
          </button>

          <p className="mt-3 text-center text-[11px] text-ink-500">
            Bấm Gửi nghĩa là bạn đồng ý Điều khoản & Chính sách bảo mật của Servify.
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  as,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  as?: "textarea";
}) {
  const base =
    "mt-1 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
  return (
    <div>
      <label className="text-xs font-semibold uppercase tracking-widest text-ink-500">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {as === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${base} min-h-[80px] resize-y`}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          required={required}
          className={base}
        />
      )}
    </div>
  );
}
