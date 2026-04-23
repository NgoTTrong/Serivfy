"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatVND } from "@/lib/format";

type RestaurantRow = {
  id: string;
  name: string;
  slug: string;
  phone: string | null;
  status: "ACTIVE" | "SUSPENDED" | "EXPIRED";
  planTier: "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE";
  trialEndsAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  _count: { tables: number; staff: number; menuItems: number; sessions: number };
};

type StatusFilter = "ALL" | "ACTIVE" | "SUSPENDED" | "EXPIRED";

const PLAN_META: Record<
  string,
  { icon: string; label: string; tone: string }
> = {
  TRIAL: { icon: "🎁", label: "Trial", tone: "bg-amber-500/15 text-amber-300 ring-amber-500/20" },
  STARTER: { icon: "🌱", label: "Starter", tone: "bg-green-500/15 text-green-300 ring-green-500/20" },
  PRO: { icon: "⭐", label: "Pro", tone: "bg-brand-500/20 text-brand-300 ring-brand-500/30" },
  ENTERPRISE: {
    icon: "🏢",
    label: "Enterprise",
    tone: "bg-purple-500/15 text-purple-300 ring-purple-500/20",
  },
};

const STATUS_META: Record<string, { label: string; tone: string; dot: string }> = {
  ACTIVE: { label: "Đang hoạt động", tone: "text-green-300 bg-green-500/10", dot: "bg-green-400" },
  SUSPENDED: { label: "Đình chỉ", tone: "text-red-300 bg-red-500/10", dot: "bg-red-400" },
  EXPIRED: { label: "Hết hạn", tone: "text-amber-300 bg-amber-500/10", dot: "bg-amber-400" },
};

export default function RestaurantsClient() {
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter !== "ALL") params.set("status", filter);
    if (q.trim()) params.set("q", q.trim());
    const r = await fetch(`/api/platform/restaurants?${params.toString()}`);
    setLoading(false);
    if (r.ok) setRows((await r.json()).restaurants || []);
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [filter, q]);

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Cửa hàng</h1>
          <p className="mt-1 text-sm text-white/60">
            {loading ? "Đang tải..." : `${rows.length} cửa hàng`} · bấm để xem chi tiết
          </p>
        </div>
        <input
          type="search"
          placeholder="🔍 Tìm theo tên, slug, SĐT..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm outline-none placeholder:text-white/40 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/30 md:w-80"
        />
      </div>

      {/* Filter pills */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(["ALL", "ACTIVE", "SUSPENDED", "EXPIRED"] as StatusFilter[]).map((f) => {
          const count =
            f === "ALL"
              ? rows.length
              : rows.filter((r) => r.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                filter === f
                  ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30"
                  : "bg-white/5 text-white/70 ring-1 ring-white/10 hover:bg-white/10"
              }`}
            >
              <span>
                {f === "ALL"
                  ? "Tất cả"
                  : STATUS_META[f]?.label}
              </span>
              {f !== "ALL" && filter === "ALL" && (
                <span className="rounded-full bg-white/20 px-1.5 text-[10px]">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid cards */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading && rows.length === 0 &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-white/5 shimmer" />
          ))}

        {!loading && rows.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-12 text-center text-white/50">
            <div className="text-4xl">🏪</div>
            <p className="mt-3 font-medium">Không có cửa hàng phù hợp</p>
            <p className="mt-1 text-xs">Thử đổi filter hoặc xoá từ khoá tìm kiếm</p>
          </div>
        )}

        {rows.map((r) => {
          const plan = PLAN_META[r.planTier] ?? {
            icon: "•",
            label: r.planTier,
            tone: "bg-white/5 text-white/60 ring-white/10",
          };
          const status = STATUS_META[r.status];
          const trialLeft =
            r.trialEndsAt && r.planTier === "TRIAL"
              ? Math.max(
                  0,
                  Math.ceil(
                    (new Date(r.trialEndsAt).getTime() - Date.now()) / 86400000,
                  ),
                )
              : null;
          return (
            <Link
              key={r.id}
              href={`/superadmin/restaurants/${r.id}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-brand-500/40 hover:bg-white/[0.06] hover:shadow-xl hover:shadow-brand-900/30"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-lg font-bold text-white">
                    {r.name}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-white/50">
                    /{r.slug}
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${plan.tone}`}
                >
                  <span>{plan.icon}</span>
                  {plan.label}
                </span>
              </div>

              <div
                className={`mt-3 inline-flex self-start items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${status.tone}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                {status.label}
              </div>

              {trialLeft !== null && (
                <div className="mt-2 text-[11px] text-amber-300">
                  ⏳ Còn {trialLeft} ngày dùng thử
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Mini label="Bàn" value={r._count.tables} />
                <Mini label="Món" value={r._count.menuItems} />
                <Mini label="NV" value={r._count.staff} />
              </div>

              <div className="mt-auto flex items-end justify-between pt-4 text-[11px] text-white/50">
                <div>
                  Tạo {new Date(r.createdAt).toLocaleDateString("vi-VN")}
                </div>
                <span className="inline-flex items-center gap-1 font-semibold text-brand-300 transition group-hover:gap-2">
                  Chi tiết →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/5 py-2 ring-1 ring-white/5">
      <div className="font-display text-lg font-bold leading-none text-white">
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-widest text-white/50">
        {label}
      </div>
    </div>
  );
}

void formatVND;
