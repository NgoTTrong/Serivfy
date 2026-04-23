"use client";

import { useEffect, useState } from "react";
import { formatVND } from "@/lib/format";

type Badge = "NEW" | "RETURNING" | "REGULAR" | "LOYAL" | "VIP";
type Segment =
  | "ALL"
  | "VIP"
  | "LOYAL"
  | "REGULAR"
  | "RETURNING"
  | "NEW"
  | "AT_RISK"
  | "THIS_WEEK";

type Customer = {
  id: string;
  nickname: string | null;
  deviceAlias: string;
  visitCount: number;
  totalSpent: number;
  firstVisit: string;
  lastVisit: string;
  badge: Badge;
  topItems: string[];
};

type Summary = {
  total: number;
  vip: number;
  loyal: number;
  regular: number;
  atRisk: number;
};

const BADGE_UI: Record<Badge, { icon: string; label: string; tone: string }> = {
  NEW: { icon: "👋", label: "Mới", tone: "bg-ink-100 text-ink-700" },
  RETURNING: { icon: "🎉", label: "Trở lại", tone: "bg-amber-100 text-amber-800" },
  REGULAR: { icon: "🔖", label: "Quen", tone: "bg-blue-100 text-blue-700" },
  LOYAL: { icon: "💛", label: "Thân thiết", tone: "bg-brand-100 text-brand-700" },
  VIP: {
    icon: "👑",
    label: "VIP",
    tone: "bg-gradient-to-r from-amber-400 to-brand-500 text-white",
  },
};

const SEGMENTS: { v: Segment; label: string }[] = [
  { v: "ALL", label: "Tất cả" },
  { v: "VIP", label: "👑 VIP" },
  { v: "LOYAL", label: "💛 Thân thiết" },
  { v: "REGULAR", label: "🔖 Quen" },
  { v: "RETURNING", label: "🎉 Trở lại" },
  { v: "NEW", label: "👋 Mới" },
  { v: "AT_RISK", label: "⚠️ Có nguy cơ rời đi" },
  { v: "THIS_WEEK", label: "📅 Tuần này" },
];

export default function CustomersClient() {
  const [segment, setSegment] = useState<Segment>("ALL");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ customers: Customer[]; summary: Summary } | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (segment !== "ALL") params.set("segment", segment);
    if (q.trim()) params.set("q", q.trim());
    const r = await fetch(`/api/admin/customers?${params.toString()}`);
    setLoading(false);
    if (r.ok) setData(await r.json());
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [segment, q]);

  return (
    <div className="p-6 md:p-10">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">
            Khách quen
          </h1>
          <span className="rounded-full bg-gradient-to-r from-amber-400 to-brand-500 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
            Servify Memory
          </span>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Khách nào đang ở lại, khách nào sắp rời đi — tất cả tự động, không cần app
          khách cài riêng.
        </p>
      </div>

      {/* Summary cards */}
      <div className="mt-6 grid gap-3 md:grid-cols-4">
        <SummaryCard
          label="Tổng khách nhận diện"
          value={data?.summary.total}
          icon="👥"
          tone="bg-blue-100 text-blue-700"
        />
        <SummaryCard
          label="VIP"
          value={data?.summary.vip}
          icon="👑"
          tone="bg-gradient-to-br from-amber-200 to-brand-200 text-brand-800"
        />
        <SummaryCard
          label="Thân thiết"
          value={data?.summary.loyal}
          icon="💛"
          tone="bg-brand-100 text-brand-700"
        />
        <SummaryCard
          label="Có nguy cơ rời đi"
          value={data?.summary.atRisk}
          icon="⚠️"
          tone="bg-red-100 text-red-700"
        />
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {SEGMENTS.map((s) => (
            <button
              key={s.v}
              onClick={() => setSegment(s.v)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                segment === s.v
                  ? "bg-brand-600 text-white shadow"
                  : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="🔍 Tìm theo tên / device..."
          className="w-full rounded-full border border-ink-200 bg-white px-5 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 md:w-72"
        />
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-[10px] uppercase tracking-widest text-ink-500">
            <tr>
              <th className="px-5 py-3">Khách</th>
              <th className="px-5 py-3">Hạng</th>
              <th className="px-5 py-3 text-right">Số lần ghé</th>
              <th className="px-5 py-3 text-right">Tổng chi</th>
              <th className="px-5 py-3">Yêu thích</th>
              <th className="px-5 py-3">Lần cuối</th>
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-ink-100">
                  <td className="px-5 py-4">
                    <div className="h-4 w-32 rounded bg-ink-100 shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-5 w-16 rounded-full bg-ink-100 shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-10 rounded bg-ink-100 shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="ml-auto h-4 w-20 rounded bg-ink-100 shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-28 rounded bg-ink-100 shimmer" />
                  </td>
                  <td className="px-5 py-4">
                    <div className="h-4 w-16 rounded bg-ink-100 shimmer" />
                  </td>
                </tr>
              ))}
            {!loading && data && data.customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-ink-500">
                  Chưa có khách trong phân khúc này
                </td>
              </tr>
            )}
            {data?.customers.map((c) => {
              const b = BADGE_UI[c.badge];
              const daysAgo = Math.floor(
                (Date.now() - new Date(c.lastVisit).getTime()) / 86400000,
              );
              return (
                <tr key={c.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                  <td className="px-5 py-3">
                    <div className="font-semibold">
                      {c.nickname ?? `Khách #${c.deviceAlias}`}
                    </div>
                    <div className="font-mono text-[10px] text-ink-400">
                      {c.deviceAlias}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${b.tone}`}
                    >
                      <span>{b.icon}</span>
                      {b.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold">
                    {c.visitCount}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-brand-700">
                    {formatVND(c.totalSpent)}
                  </td>
                  <td className="px-5 py-3">
                    {c.topItems.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.topItems.map((t, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-ink-400">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-ink-600">
                    {daysAgo === 0
                      ? "Hôm nay"
                      : daysAgo === 1
                        ? "Hôm qua"
                        : `${daysAgo} ngày trước`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-center text-[11px] text-ink-400">
        Khách không phải cài app — chỉ quét QR là Servify nhớ.
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | undefined;
  icon: string;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">
          {label}
        </div>
        <span
          className={`inline-flex h-8 w-8 flex-none items-center justify-center rounded-xl text-base ${tone}`}
        >
          {icon}
        </span>
      </div>
      {value === undefined ? (
        <div className="mt-3 h-9 w-16 rounded-lg bg-ink-100 shimmer" />
      ) : (
        <div className="mt-2 font-display text-3xl font-bold text-ink-950">{value}</div>
      )}
    </div>
  );
}
