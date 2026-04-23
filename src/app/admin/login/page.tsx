"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      setErr("Email hoặc mật khẩu sai");
      return;
    }
    const data = await res.json();
    const role = data.staff.role;
    const restaurantId = data.staff.restaurantId;
    if (role === "ADMIN") router.push(`/admin/${restaurantId}/dashboard`);
    else if (role === "WAITER") router.push(`/waiter/${restaurantId}`);
    else if (role === "KITCHEN") router.push(`/kitchen/${restaurantId}`);
    else router.push("/");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-100 via-white to-brand-100">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
        <div className="grid w-full items-center gap-12 md:grid-cols-2">
          <div className="hidden md:block">
            <Link href="/" className="inline-flex items-center gap-2 text-ink-900">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6">
                  <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zM14 3h7v7h-7V3zm0 13h3v3h-3v-3zm4 0h3v3h-3v-3zm0 4h3v1h-3v-1z" />
                </svg>
              </span>
              <span className="font-display text-3xl font-bold">Servify</span>
            </Link>
            <h1 className="mt-8 font-display text-5xl font-bold leading-tight text-ink-950">
              Đăng nhập<br />
              <span className="text-brand-600">vào bếp / quán của bạn</span>
            </h1>
            <p className="mt-5 max-w-md text-ink-600">
              Admin quản lý menu & doanh thu. Waiter tick món đã phục vụ. Kitchen xem đơn đang nấu.
            </p>
            <div className="mt-8 space-y-2 text-sm text-ink-600">
              <DemoCred label="Admin" email="admin@test.com" />
              <DemoCred label="Waiter" email="waiter@test.com" />
              <DemoCred label="Kitchen" email="kitchen@test.com" />
              <div className="mt-2 text-xs">Password chung: <span className="font-mono">123456</span></div>
            </div>
          </div>

          <form
            onSubmit={submit}
            className="rounded-3xl border border-ink-100 bg-white p-8 shadow-xl shadow-brand-200/30"
          >
            <div className="md:hidden">
              <Link href="/" className="inline-flex items-center gap-2 text-ink-900">
                <span className="font-display text-2xl font-bold">Servify</span>
              </Link>
            </div>
            <h2 className="mt-2 font-display text-3xl font-bold text-ink-950">Đăng nhập</h2>
            <p className="mt-1 text-sm text-ink-500">Dành cho nhân viên & quản lý</p>

            <label className="mt-6 block text-sm font-medium text-ink-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />

            <label className="mt-4 block text-sm font-medium text-ink-700">Mật khẩu</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />

            {err && <div className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

            <button
              type="submit"
              disabled={loading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-50"
            >
              {loading && <Spinner className="h-4 w-4" />}
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            <Link href="/" className="mt-4 block text-center text-sm text-ink-500 hover:text-brand-600">
              ← Quay về trang chủ
            </Link>
          </form>
        </div>
      </div>
    </main>
  );
}

function DemoCred({ label, email }: { label: string; email: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
        {label}
      </span>
      <span className="font-mono text-xs">{email}</span>
    </div>
  );
}
