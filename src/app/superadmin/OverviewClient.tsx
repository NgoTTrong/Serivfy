"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatVND } from "@/lib/format";

type Stats = {
  totalRestaurants: number;
  active: number;
  suspended: number;
  expired: number;
  trial: number;
  pending: number;
  paidTierCounts: { tier: string; count: number }[];
  revenueTodayVND: number;
  newRestaurantsToday: number;
};

const TIER_META: Record<string, { icon: string; label: string; tone: string }> = {
  TRIAL: { icon: "🎁", label: "Trial", tone: "bg-amber-500/15 text-amber-300" },
  STARTER: { icon: "🌱", label: "Starter", tone: "bg-green-500/15 text-green-300" },
  PRO: { icon: "⭐", label: "Pro", tone: "bg-brand-500/20 text-brand-300" },
  ENTERPRISE: {
    icon: "🏢",
    label: "Enterprise",
    tone: "bg-purple-500/15 text-purple-300",
  },
};

export default function OverviewClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const r = await fetch("/api/platform/stats");
      if (!alive) return;
      if (r.ok) {
        setStats(await r.json());
        setLastSync(new Date());
      }
    }
    load();
    const iv = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  return (
    <div className="p-6 md:p-10">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-white md:text-4xl">
            Platform Overview
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-white/60">
            <span>Sức khoẻ toàn hệ thống Servify SaaS</span>
            {lastSync && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-300 ring-1 ring-green-500/20">
                <span className="h-1.5 w-1.5 animate-pulsebar rounded-full bg-green-400" />
                Live · cập nhật {lastSync.toLocaleTimeString("vi-VN")}
              </span>
            )}
          </p>
        </div>
        {stats && stats.pending > 0 && (
          <Link
            href="/superadmin/requests"
            className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-ink-950 shadow-lg shadow-amber-400/30 transition hover:-translate-y-0.5 hover:bg-amber-300"
          >
            <span className="text-lg">🔔</span>
            <span>
              {stats.pending} yêu cầu chờ duyệt
            </span>
          </Link>
        )}
      </div>

      {/* Hero revenue band */}
      <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-900/40 via-ink-900 to-brand-950 p-6 shadow-2xl shadow-brand-900/30 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-300">
              Doanh thu toàn platform hôm nay
            </div>
            {stats ? (
              <div className="mt-2 font-display text-5xl font-bold text-white md:text-6xl">
                {formatVND(stats.revenueTodayVND)}
              </div>
            ) : (
              <div className="mt-3 h-14 w-64 rounded-xl bg-white/10 shimmer" />
            )}
            <div className="mt-2 flex items-center gap-2 text-sm text-white/70">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-0.5 text-xs ring-1 ring-white/10">
                🏪 +{stats?.newRestaurantsToday ?? 0} cửa hàng mới
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-0.5 text-xs ring-1 ring-white/10">
                ✅ {stats?.active ?? 0} đang hoạt động
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white/5 p-2 backdrop-blur">
            {(["TRIAL", "STARTER", "PRO", "ENTERPRISE"] as const).map((tier) => {
              const count =
                stats?.paidTierCounts.find((c) => c.tier === tier)?.count ?? 0;
              const meta = TIER_META[tier];
              const inactive = count === 0;
              return (
                <div
                  key={tier}
                  className={`flex flex-col items-center rounded-xl px-2 py-2 text-center transition ${
                    inactive ? "bg-white/[0.02] text-white/30" : meta.tone
                  }`}
                  title={meta.label}
                >
                  <span className="text-base">{meta.icon}</span>
                  <span className="text-[9px] font-semibold uppercase tracking-widest opacity-80">
                    {meta.label}
                  </span>
                  <span
                    className={`font-display text-lg font-bold ${
                      inactive ? "text-white/40" : ""
                    }`}
                  >
                    {stats ? count : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Lifecycle stats */}
      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <StatPill
          label="Tổng cửa hàng"
          value={stats?.totalRestaurants}
          icon="🏪"
          tone="brand"
        />
        <StatPill
          label="Đang hoạt động"
          value={stats?.active}
          icon="✅"
          tone="green"
        />
        <StatPill label="Đang dùng thử" value={stats?.trial} icon="🎁" tone="amber" />
        <StatPill
          label="Đình chỉ / Hết hạn"
          value={stats ? stats.suspended + stats.expired : null}
          icon="⏸️"
          tone="red"
        />
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <QuickCard
          href="/superadmin/requests"
          icon="📮"
          title="Duyệt yêu cầu"
          desc="Approve / Reject signup mới"
          tone="from-amber-500/20 to-amber-600/5"
          badge={stats && stats.pending > 0 ? String(stats.pending) : null}
        />
        <QuickCard
          href="/superadmin/restaurants"
          icon="🏪"
          title="Quản lý cửa hàng"
          desc="Suspend · Change plan · Impersonate"
          tone="from-blue-500/20 to-blue-600/5"
        />
        <QuickCard
          href="/superadmin/audit"
          icon="🧾"
          title="Audit log"
          desc="Xem 200 hành động gần nhất"
          tone="from-purple-500/20 to-purple-600/5"
        />
      </div>
    </div>
  );
}

function StatPill({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | undefined | null;
  icon: string;
  tone: "brand" | "green" | "amber" | "red";
}) {
  const tones = {
    brand: "from-brand-500/15 to-brand-500/5 text-brand-300 ring-brand-500/20",
    green: "from-green-500/15 to-green-500/5 text-green-300 ring-green-500/20",
    amber: "from-amber-500/15 to-amber-500/5 text-amber-300 ring-amber-500/20",
    red: "from-red-500/15 to-red-500/5 text-red-300 ring-red-500/20",
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20 hover:bg-white/[0.06]">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
          {label}
        </div>
        <span
          className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br text-lg ring-1 ${tones[tone]}`}
        >
          {icon}
        </span>
      </div>
      {value === undefined || value === null ? (
        <div className="mt-3 h-9 w-16 rounded-lg bg-white/10 shimmer" />
      ) : (
        <div className="mt-2 font-display text-4xl font-bold leading-none text-white">
          {value}
        </div>
      )}
    </div>
  );
}

function QuickCard({
  href,
  icon,
  title,
  desc,
  tone,
  badge,
}: {
  href: string;
  icon: string;
  title: string;
  desc: string;
  tone: string;
  badge?: string | null;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${tone} p-5 transition hover:-translate-y-0.5 hover:border-white/25 hover:shadow-xl hover:shadow-black/30`}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white/10 text-2xl transition group-hover:scale-110">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-white">{title}</h3>
            {badge && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-ink-950">
                {badge}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-white/60">{desc}</p>
        </div>
      </div>
      <div className="pointer-events-none absolute right-4 bottom-3 text-xl text-white/30 transition group-hover:translate-x-1 group-hover:text-white">
        →
      </div>
    </Link>
  );
}
