"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ImpersonateBanner } from "@/components/ImpersonateBanner";
import { TrialBanner } from "@/components/TrialBanner";
import { OfflineAgentBanner } from "@/components/OfflineAgentBanner";

type PlanInfo = {
  planTier: "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE";
  trialEndsAt: string | null;
  daysLeft: number | null;
};

export default function AdminShell({
  restaurantId,
  staffName,
  restaurantName,
  planInfo,
  children,
}: {
  restaurantId: string;
  staffName: string;
  restaurantName?: string;
  planInfo?: PlanInfo;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/admin/${restaurantId}`;
  const nav = [
    { href: `${base}/dashboard`, label: "Dashboard", icon: "📊" },
    { href: `/pos/${restaurantId}`, label: "POS", icon: "🧾" },
    { href: `${base}/analytics`, label: "Báo cáo", icon: "📈" },
    { href: `${base}/customers`, label: "Khách quen", icon: "💛" },
    { href: `${base}/menu`, label: "Thực đơn", icon: "🍽️" },
    { href: `${base}/vouchers`, label: "Mã giảm", icon: "🎟️" },
    { href: `${base}/tables`, label: "Bàn & QR", icon: "🪑" },
    { href: `${base}/branches`, label: "Chi nhánh", icon: "🏢" },
    { href: `${base}/shifts`, label: "Quản lý ca", icon: "🕛" },
    { href: `${base}/printers`, label: "Máy in", icon: "🖨️" },
    { href: `${base}/receipt`, label: "Mẫu hoá đơn", icon: "🧾" },
    { href: `${base}/staff`, label: "Nhân viên", icon: "👥" },
    { href: `${base}/audit`, label: "Nhật ký", icon: "📜" },
    { href: `${base}/einvoices`, label: "HĐ điện tử", icon: "📄" },
    { href: `${base}/billing`, label: "Gói & thanh toán", icon: "💳" },
    { href: `${base}/settings`, label: "Cài đặt", icon: "⚙️" },
  ];
  const currentNav = nav.find((n) => pathname.startsWith(n.href));
  void restaurantName;

  return (
    <div className="min-h-screen bg-ink-50">
      <ImpersonateBanner />
      {planInfo && <TrialBanner restaurantId={restaurantId} planInfo={planInfo} />}
      <OfflineAgentBanner />

      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-ink-100 bg-white md:flex">
          <div className="px-6 py-6">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                  <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zM14 3h7v7h-7V3zm0 13h3v3h-3v-3zm4 0h3v3h-3v-3zm0 4h3v1h-3v-1z" />
                </svg>
              </span>
              <span className="font-display text-xl font-bold">Servify</span>
            </Link>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {nav.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition ${
                    active
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "text-ink-700 hover:bg-ink-50"
                  }`}
                >
                  <span className="text-lg">{n.icon}</span>
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-ink-100 p-4">
            <div className="text-xs text-ink-500">Đang đăng nhập</div>
            <div className="font-semibold">{staffName}</div>
            <form action="/api/auth/logout" method="post" className="mt-2">
              <button className="w-full rounded-lg bg-ink-100 py-2 text-sm text-ink-700 hover:bg-ink-200">
                Đăng xuất
              </button>
            </form>
          </div>
        </aside>

        <main className="flex-1 overflow-x-hidden">
          <div className="sticky top-0 z-10 border-b border-ink-100 bg-white/80 px-6 py-3 backdrop-blur">
            <nav className="flex items-center gap-2 text-sm text-ink-500">
              <Link href={base + "/dashboard"} className="hover:text-brand-600">
                Servify
              </Link>
              <span>/</span>
              <span className="font-semibold text-ink-900">
                {currentNav?.label ?? "Admin"}
              </span>
            </nav>
          </div>
          <div className="border-b border-ink-100 bg-white px-6 py-3 md:hidden">
            <div className="flex flex-wrap gap-2">
              {nav.map((n) => {
                const active = pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      active ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-700"
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
    </div>
  );
}
