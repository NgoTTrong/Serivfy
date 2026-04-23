"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatVND } from "@/lib/format";

type Stats = {
  sessionsToday: number;
  activeSessions: number;
  revenueToday: number;
  unitsToday: number;
  hourly: { hour: number; revenue: number }[];
};

export default function DashboardClient({ restaurantId }: { restaurantId: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const r = await fetch(`/api/admin/dashboard`);
      if (!alive) return;
      if (r.ok) {
        setStats(await r.json());
        setLastSync(new Date());
      }
    }
    load();
    const iv = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, []);

  const hasRevenue = (stats?.revenueToday ?? 0) > 0;
  const maxHour = Math.max(1, ...(stats?.hourly.map((h) => h.revenue) || [1]));
  const currentHour = new Date().getHours();

  return (
    <div className="p-4 md:p-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">
            Dashboard
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-ink-500">
            <span>
              {new Date().toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            {lastSync && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                <span className="h-1.5 w-1.5 animate-pulsebar rounded-full bg-green-500" />
                Live
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/waiter/${restaurantId}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
          >
            <span>🛎️</span>
            <span>Waiter</span>
          </Link>
          <Link
            href={`/kitchen/${restaurantId}`}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800"
          >
            <span>🍳</span>
            <span>KDS</span>
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
        <StatCard
          icon="💰"
          iconBg="bg-brand-100 text-brand-700"
          label="Doanh thu hôm nay"
          value={stats ? formatVND(stats.revenueToday) : null}
          big
        />
        <StatCard
          icon="🪑"
          iconBg="bg-blue-100 text-blue-700"
          label="Bàn đang phục vụ"
          value={stats ? String(stats.activeSessions) : null}
        />
        <StatCard
          icon="👥"
          iconBg="bg-purple-100 text-purple-700"
          label="Lượt khách"
          value={stats ? String(stats.sessionsToday) : null}
        />
        <StatCard
          icon="🍽️"
          iconBg="bg-amber-100 text-amber-700"
          label="Món đã bán"
          value={stats ? String(stats.unitsToday) : null}
        />
      </div>

      <div className="mt-6 rounded-3xl border border-ink-100 bg-white p-5 md:p-6">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-ink-950">
              Doanh thu theo giờ
            </h2>
            <p className="text-xs text-ink-500">
              Đỉnh: {formatVND(maxHour)} · Đơn vị: VND
            </p>
          </div>
          {hasRevenue && stats && (
            <div className="text-right text-sm">
              <div className="text-xs text-ink-500">Giờ nhộn nhịp</div>
              <div className="font-display font-bold text-ink-950">
                {
                  stats.hourly.reduce(
                    (max, h) => (h.revenue > max.revenue ? h : max),
                    stats.hourly[0]
                  )?.hour
                }
                h
              </div>
            </div>
          )}
        </div>

        {!stats ? (
          <div className="mt-5 h-48 rounded-xl bg-ink-50 shimmer" />
        ) : !hasRevenue ? (
          <div className="mt-5 flex h-48 flex-col items-center justify-center rounded-xl bg-ink-50 text-center">
            <div className="text-4xl">📈</div>
            <p className="mt-3 font-medium text-ink-700">Chưa có doanh thu hôm nay</p>
            <p className="mt-1 text-xs text-ink-500">
              Biểu đồ sẽ cập nhật khi bàn đầu tiên thanh toán
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 flex h-48 items-end gap-1">
              {stats.hourly.map((h) => {
                const heightPct = Math.max(h.revenue > 0 ? 4 : 0, (h.revenue / maxHour) * 100);
                const isCurrent = h.hour === currentHour;
                return (
                  <div
                    key={h.hour}
                    className="group relative flex h-full flex-1 flex-col justify-end"
                    title={`${h.hour}h: ${formatVND(h.revenue)}`}
                  >
                    {h.revenue > 0 && (
                      <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-950 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow transition group-hover:opacity-100">
                        {formatVND(h.revenue)}
                      </div>
                    )}
                    <div
                      className={`w-full rounded-t transition-all ${
                        isCurrent
                          ? "bg-gradient-to-t from-brand-500 to-brand-700 ring-2 ring-brand-300"
                          : h.revenue > 0
                            ? "bg-gradient-to-t from-brand-300 to-brand-500"
                            : "bg-ink-100"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex gap-1">
              {stats.hourly.map((h) => (
                <div
                  key={h.hour}
                  className={`flex-1 text-center text-[10px] ${
                    h.hour === currentHour ? "font-bold text-brand-700" : "text-ink-400"
                  }`}
                >
                  {h.hour}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <QuickAction
          href={`/admin/${restaurantId}/menu`}
          icon="🍽️"
          title="Quản lý thực đơn"
          sub="Thêm món, cập nhật giá, bật/tắt hết món"
        />
        <QuickAction
          href={`/admin/${restaurantId}/tables`}
          icon="🪑"
          title="Bàn & QR"
          sub="In mã QR dán lên bàn khi mở thêm"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  big,
}: {
  icon: string;
  iconBg: string;
  label: string;
  value: string | null;
  big?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 transition hover:border-brand-200 hover:shadow-md md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          {label}
        </div>
        <span
          className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-xl text-base ${iconBg}`}
        >
          {icon}
        </span>
      </div>
      {value === null ? (
        <div
          className={`mt-3 rounded-lg bg-ink-100 shimmer ${
            big ? "h-9 w-32" : "h-8 w-20"
          }`}
        />
      ) : (
        <div
          className={`mt-2 font-display font-bold leading-tight text-ink-950 ${
            big ? "text-2xl md:text-3xl" : "text-2xl md:text-3xl"
          }`}
        >
          {value}
        </div>
      )}
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: string;
  title: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-5 transition hover:border-brand-300 hover:shadow-lg"
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl transition group-hover:bg-brand-100 group-hover:scale-110">
        {icon}
      </span>
      <div className="flex-1">
        <div className="font-semibold text-ink-950">{title}</div>
        <div className="text-xs text-ink-500">{sub}</div>
      </div>
      <span className="text-ink-400 transition group-hover:translate-x-1 group-hover:text-brand-600">
        →
      </span>
    </Link>
  );
}
