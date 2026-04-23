"use client";

import { useEffect, useState } from "react";
import { formatVND } from "@/lib/format";
import { useDialog } from "@/components/DialogProvider";

type Range = "TODAY" | "WEEK" | "MONTH" | "CUSTOM";

type Analytics = {
  range: Range;
  from: string;
  to: string;
  revenue: number;
  units: number;
  sessionsCompleted: number;
  aov: number;
  avgSessionMinutes: number;
  dailySeries: { date: string; revenue: number }[];
  hourly: number[];
  dow: number[];
  topItems: {
    menuItemId: string;
    name: string;
    qty: number;
    revenue: number;
    image: string | null;
  }[];
  slowItems: {
    menuItemId: string;
    name: string;
    qty: number;
    revenue: number;
    image: string | null;
  }[];
};

const DOW_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export default function AnalyticsClient({ restaurantId }: { restaurantId: string }) {
  const dialog = useDialog();
  const [range, setRange] = useState<Range>("WEEK");
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load(r: Range) {
    setLoading(true);
    setErr(null);
    const res = await fetch(`/api/admin/analytics?range=${r}`);
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => null);
      setErr(d?.message ?? "Không tải được báo cáo");
      setData(null);
      return;
    }
    setData(await res.json());
  }

  useEffect(() => {
    load(range);
  }, [range]);

  function exportCsv() {
    if (!data) return;
    const url = `/api/admin/export/sessions?from=${encodeURIComponent(data.from)}&to=${encodeURIComponent(data.to)}`;
    window.location.href = url;
  }

  const maxHourly = Math.max(1, ...(data?.hourly ?? [1]));
  const maxDow = Math.max(1, ...(data?.dow ?? [1]));
  const maxDaily = Math.max(1, ...(data?.dailySeries.map((d) => d.revenue) ?? [1]));
  const maxTopQty = Math.max(1, ...(data?.topItems.map((i) => i.qty) ?? [1]));

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">
            Báo cáo
          </h1>
          <p className="text-sm text-ink-500">
            Xem xu hướng doanh thu, món bán chạy, giờ cao điểm
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!data || data.sessionsCompleted === 0}
          className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap rounded-full bg-ink-950 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
        >
          <span>⬇️</span>
          <span className="hidden sm:inline">Xuất CSV</span>
          <span className="sm:hidden">CSV</span>
        </button>
      </div>

      {/* Range picker */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            { v: "TODAY", label: "Hôm nay" },
            { v: "WEEK", label: "7 ngày" },
            { v: "MONTH", label: "30 ngày" },
          ] as const
        ).map((o) => (
          <button
            key={o.v}
            onClick={() => setRange(o.v)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              range === o.v
                ? "bg-brand-600 text-white shadow-lg shadow-brand-600/20"
                : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          ⚠️ {err}{" "}
          <a
            href={`/admin/${restaurantId}/billing`}
            className="font-semibold text-brand-700 underline"
          >
            Nâng cấp
          </a>
        </div>
      )}

      {/* Overview cards */}
      <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card
          label="Doanh thu"
          value={data ? formatVND(data.revenue) : null}
          icon="💰"
          tone="brand"
          big
          loading={loading}
        />
        <Card
          label="Số phiên đã đóng"
          value={data ? String(data.sessionsCompleted) : null}
          icon="🧾"
          tone="blue"
          loading={loading}
        />
        <Card
          label="Giá trị TB/bàn"
          value={data ? formatVND(data.aov) : null}
          icon="📊"
          tone="purple"
          loading={loading}
        />
        <Card
          label="Thời gian TB/bàn"
          value={data ? `${data.avgSessionMinutes}p` : null}
          icon="⏱️"
          tone="amber"
          loading={loading}
        />
      </div>

      {/* Daily revenue chart */}
      {data && data.dailySeries.length > 1 && (
        <div className="mt-6 rounded-3xl border border-ink-100 bg-white p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Doanh thu theo ngày</h2>
              <p className="text-xs text-ink-500">
                Đỉnh: {formatVND(maxDaily)} · {data.dailySeries.length} ngày
              </p>
            </div>
            {data.dailySeries.filter((d) => d.revenue > 0).length < data.dailySeries.length / 2 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                Dữ liệu còn ít
              </span>
            )}
          </div>
          {data.revenue === 0 ? (
            <div className="mt-5 flex h-48 flex-col items-center justify-center rounded-xl bg-ink-50 text-center">
              <div className="text-4xl">📊</div>
              <p className="mt-3 font-medium text-ink-700">Chưa có doanh thu trong kỳ này</p>
              <p className="mt-1 text-xs text-ink-500">
                Biểu đồ sẽ đầy lên khi có bàn thanh toán
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 flex h-48 items-end gap-1">
                {data.dailySeries.map((d) => {
                  const h = Math.max(d.revenue > 0 ? 4 : 0, (d.revenue / maxDaily) * 100);
                  return (
                    <div
                      key={d.date}
                      className="group relative flex h-full flex-1 flex-col justify-end"
                      title={`${d.date}: ${formatVND(d.revenue)}`}
                    >
                      {d.revenue > 0 && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink-950 px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow transition group-hover:opacity-100">
                          {formatVND(d.revenue)}
                        </div>
                      )}
                      <div
                        className={`w-full rounded-t transition-all ${
                          d.revenue > 0
                            ? "bg-gradient-to-t from-brand-400 to-brand-600"
                            : "bg-ink-100"
                        }`}
                        style={{ height: `${Math.max(h, d.revenue > 0 ? 4 : 2)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-1">
                {data.dailySeries.map((d) => (
                  <div
                    key={d.date}
                    className={`flex-1 text-center text-[9px] ${
                      d.revenue > 0 ? "text-ink-700 font-semibold" : "text-ink-300"
                    }`}
                    title={d.date}
                  >
                    {d.date.slice(5)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Top items + Hourly */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-ink-100 bg-white p-6">
          <h2 className="font-display text-xl font-bold">🏆 Top 10 món bán chạy</h2>
          <p className="text-xs text-ink-500">Theo số lượng đã bán</p>
          {data && data.topItems.length === 0 && (
            <div className="mt-4 rounded-xl bg-ink-50 p-6 text-center text-sm text-ink-500">
              Chưa có dữ liệu trong khoảng này
            </div>
          )}
          <ol className="mt-4 space-y-2">
            {data?.topItems.map((it, i) => {
              const w = (it.qty / maxTopQty) * 100;
              return (
                <li key={it.menuItemId} className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-brand-100 font-display font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{it.name}</span>
                      <span className="whitespace-nowrap text-sm font-semibold text-brand-700">
                        {it.qty} bán
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-500">
                      Doanh thu {formatVND(it.revenue)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-3xl border border-ink-100 bg-white p-6">
          <h2 className="font-display text-xl font-bold">⏰ Giờ cao điểm</h2>
          <p className="text-xs text-ink-500">Doanh thu theo giờ trong ngày</p>
          <div className="mt-4 flex h-40 items-end gap-1">
            {(data?.hourly ?? []).map((v, h) => {
              const hh = Math.max(v > 0 ? 4 : 0, (v / maxHourly) * 100);
              return (
                <div
                  key={h}
                  className="flex h-full flex-1 flex-col justify-end"
                  title={`${h}h: ${formatVND(v)}`}
                >
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-amber-400 to-amber-600"
                    style={{ height: `${hh}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                className="flex-1 text-center text-[9px] text-ink-400"
              >
                {h}
              </div>
            ))}
          </div>

          <h3 className="mt-6 font-display text-base font-bold">📅 Theo thứ trong tuần</h3>
          <div className="mt-3 flex h-32 items-end gap-2">
            {(data?.dow ?? []).map((v, i) => {
              const hh = Math.max(v > 0 ? 4 : 0, (v / maxDow) * 100);
              return (
                <div
                  key={i}
                  className="flex h-full flex-1 flex-col justify-end"
                  title={`${DOW_LABELS[i]}: ${formatVND(v)}`}
                >
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-blue-400 to-blue-600"
                    style={{ height: `${hh}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-2">
            {DOW_LABELS.map((l) => (
              <div key={l} className="flex-1 text-center text-[10px] font-medium text-ink-500">
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Slow items — only meaningful when there are enough sales to compare */}
      {data && data.slowItems.length > 3 && data.units >= 10 && (
        <div className="mt-6 rounded-3xl border border-ink-100 bg-white p-6">
          <h2 className="font-display text-xl font-bold">🐌 Top món ế</h2>
          <p className="text-xs text-ink-500">
            Món ít được gọi nhất — cân nhắc gỡ hoặc khuyến mãi
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {data.slowItems.slice(0, 6).map((it) => (
              <div
                key={it.menuItemId}
                className="flex items-center justify-between rounded-xl bg-ink-50 px-4 py-2 text-sm"
              >
                <span className="truncate font-medium">{it.name}</span>
                <span className="whitespace-nowrap font-mono text-ink-600">
                  {it.qty} bán
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 text-center text-xs text-ink-400">
        Khoảng {new Date(data?.from ?? Date.now()).toLocaleDateString("vi-VN")} →{" "}
        {new Date(data?.to ?? Date.now()).toLocaleDateString("vi-VN")}
      </div>
      <span className="hidden">{dialog ? 0 : 0}</span>
    </div>
  );
}

function Card({
  label,
  value,
  icon,
  tone,
  big,
  loading,
}: {
  label: string;
  value: string | null;
  icon: string;
  tone: "brand" | "blue" | "purple" | "amber";
  big?: boolean;
  loading?: boolean;
}) {
  const tones = {
    brand: "bg-brand-100 text-brand-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-4 transition hover:border-brand-200 hover:shadow-md md:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          {label}
        </div>
        <span
          className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-xl text-base ${tones[tone]}`}
        >
          {icon}
        </span>
      </div>
      {value === null || loading ? (
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
