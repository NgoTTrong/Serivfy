"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("superadmin@servify.vn");
  const [password, setPassword] = useState("123456");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    const r = await fetch("/api/platform/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (!r.ok) {
      setErr("Sai email hoặc mật khẩu");
      return;
    }
    router.push("/superadmin");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-ink-950 via-ink-900 to-brand-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-md items-center justify-center px-6">
        <form
          onSubmit={submit}
          className="w-full rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-lg"
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zM14 3h7v7h-7V3zm0 13h3v3h-3v-3zm4 0h3v3h-3v-3zm0 4h3v1h-3v-1z" />
              </svg>
            </span>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-brand-400">
                Servify Platform
              </div>
              <div className="font-display text-lg font-bold">HQ Admin</div>
            </div>
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold">Đăng nhập nội bộ</h1>
          <p className="mt-1 text-sm text-white/60">Dành cho đội ngũ Servify</p>

          <label className="mt-6 block text-xs font-semibold uppercase tracking-widest text-white/60">
            Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40"
          />
          <label className="mt-4 block text-xs font-semibold uppercase tracking-widest text-white/60">
            Mật khẩu
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40"
          />
          {err && (
            <div className="mt-3 rounded-xl bg-red-500/15 px-4 py-2 text-sm text-red-200">
              {err}
            </div>
          )}
          <button
            type="submit"
            disabled={busy}
            className="mt-6 w-full rounded-xl bg-brand-600 py-3 font-semibold shadow-lg shadow-brand-600/40 transition hover:bg-brand-500 disabled:opacity-50"
          >
            {busy ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
          <Link
            href="/"
            className="mt-4 block text-center text-xs text-white/50 hover:text-white"
          >
            ← Về trang chủ
          </Link>
        </form>
      </div>
    </main>
  );
}
