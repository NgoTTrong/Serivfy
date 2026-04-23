"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PlatformSession } from "@/lib/platform-auth";

export default function SuperShell({
  session,
  children,
}: {
  session: PlatformSession | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const onLogin = pathname === "/superadmin/login";
  if (onLogin || !session) return <>{children}</>;

  const nav = [
    { href: "/superadmin", label: "Overview", icon: "📊" },
    { href: "/superadmin/requests", label: "Yêu cầu", icon: "📮" },
    { href: "/superadmin/restaurants", label: "Cửa hàng", icon: "🏪" },
    { href: "/superadmin/settings", label: "Cài đặt", icon: "⚙️" },
    { href: "/superadmin/audit", label: "Audit log", icon: "🧾" },
  ];

  const currentNav = nav.find((n) =>
    n.href === "/superadmin" ? pathname === "/superadmin" : pathname.startsWith(n.href),
  );

  return (
    <div className="flex min-h-screen bg-ink-950 text-white">
      <aside className="sticky top-0 hidden h-screen w-64 flex-none flex-col border-r border-white/10 bg-gradient-to-b from-ink-950 to-ink-900 md:flex">
        <div className="px-6 py-6">
          <Link href="/superadmin" className="inline-flex items-center gap-2 group">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 shadow-lg shadow-brand-600/30 transition group-hover:scale-110">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-white">
                <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zM14 3h7v7h-7V3zm0 13h3v3h-3v-3zm4 0h3v3h-3v-3zm0 4h3v1h-3v-1z" />
              </svg>
            </span>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-brand-400">
                Servify
              </div>
              <div className="font-display text-xl font-bold leading-none">
                HQ Admin
              </div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map((n) => {
            const active =
              n.href === "/superadmin"
                ? pathname === "/superadmin"
                : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`group relative flex items-center gap-3 rounded-xl px-4 py-2.5 transition ${
                  active
                    ? "bg-gradient-to-r from-brand-500/25 to-brand-500/5 font-semibold text-brand-200 ring-1 ring-brand-500/30"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-brand-400" />
                )}
                <span className="text-lg">{n.icon}</span>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 font-display text-sm font-bold">
                {session.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{session.name}</div>
                <div className="truncate text-[11px] text-white/50">{session.email}</div>
              </div>
            </div>
            <form action="/api/platform/logout" method="post" className="mt-3">
              <button className="w-full rounded-lg bg-white/10 py-2 text-xs font-semibold hover:bg-white/20">
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-x-hidden bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
        {/* Sticky breadcrumb on desktop */}
        <div className="sticky top-0 z-30 hidden border-b border-white/5 bg-ink-950/80 px-6 py-3 backdrop-blur md:block">
          <nav className="flex items-center gap-2 text-xs text-white/50">
            <Link href="/superadmin" className="hover:text-white">
              HQ
            </Link>
            <span>/</span>
            <span className="font-semibold text-white">
              {currentNav?.label ?? ""}
            </span>
          </nav>
        </div>

        {/* Mobile nav pills */}
        <div className="sticky top-0 z-30 border-b border-white/10 bg-ink-950/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between">
            <Link href="/superadmin" className="inline-flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-white">
                  <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zM14 3h7v7h-7V3zm0 13h3v3h-3v-3zm4 0h3v3h-3v-3zm0 4h3v1h-3v-1z" />
                </svg>
              </span>
              <span className="font-display text-base font-bold">HQ</span>
            </Link>
            <form action="/api/platform/logout" method="post">
              <button className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
                Đăng xuất
              </button>
            </form>
          </div>
          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {nav.map((n) => {
              const active =
                n.href === "/superadmin"
                  ? pathname === "/superadmin"
                  : pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "bg-brand-600 text-white"
                      : "bg-white/10 text-white/70"
                  }`}
                >
                  {n.icon} {n.label}
                </Link>
              );
            })}
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
