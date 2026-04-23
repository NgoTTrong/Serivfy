"use client";

import { useEffect, useState } from "react";
import { useDialog } from "@/components/DialogProvider";
import { Select } from "@/components/Select";
import { Spinner } from "@/components/Spinner";

type Request = {
  id: string;
  restaurantName: string;
  slug: string;
  adminName: string;
  adminEmail: string;
  phone: string | null;
  address: string | null;
  planRequested: "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE";
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewedAt: string | null;
  rejectReason: string | null;
  createdRestaurantId: string | null;
  createdAt: string;
};

type Tab = "PENDING" | "APPROVED" | "REJECTED";

const PLAN_OPTIONS = [
  { value: "TRIAL", label: "Trial — 14 ngày", icon: "🎁" },
  { value: "STARTER", label: "Starter — 199k/tháng", icon: "🌱" },
  { value: "PRO", label: "Pro — 499k/tháng", icon: "⭐" },
  { value: "ENTERPRISE", label: "Enterprise", icon: "🏢" },
];

export default function RequestsClient() {
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>("PENDING");
  const [rows, setRows] = useState<Request[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [planOverride, setPlanOverride] = useState<Record<string, string>>({});

  async function load() {
    setLoaded(false);
    const r = await fetch(`/api/platform/requests?status=${tab}`);
    if (r.ok) setRows((await r.json()).requests || []);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, [tab]);

  async function approve(req: Request) {
    setBusyId(req.id);
    const r = await fetch(`/api/platform/requests/${req.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planOverride: planOverride[req.id] ?? req.planRequested,
      }),
    });
    setBusyId(null);
    if (r.ok) {
      dialog.toast({
        message: `Đã duyệt ${req.restaurantName}`,
        type: "success",
      });
      load();
    } else {
      const d = await r.json().catch(() => null);
      dialog.alert({
        icon: "⚠️",
        title: "Không duyệt được",
        message: d?.error ?? "Có lỗi xảy ra — kiểm tra lại.",
        tone: "danger",
      });
    }
  }

  async function reject(req: Request) {
    const ok = await dialog.confirm({
      icon: "❌",
      title: `Từ chối ${req.restaurantName}?`,
      message:
        "Yêu cầu sẽ chuyển sang REJECTED. Chủ quán có thể đăng ký lại với email này.",
      confirmLabel: "Từ chối",
      danger: true,
    });
    if (!ok) return;
    setBusyId(req.id);
    const r = await fetch(`/api/platform/requests/${req.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Không đủ điều kiện" }),
    });
    setBusyId(null);
    if (r.ok) {
      dialog.toast({ message: "Đã từ chối", type: "success" });
      load();
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div>
        <h1 className="font-display text-3xl font-bold md:text-4xl">Yêu cầu đăng ký</h1>
        <p className="mt-1 text-sm text-white/60">
          Duyệt hoặc từ chối yêu cầu mở tài khoản từ chủ quán.
        </p>
      </div>

      <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
        {(
          [
            { v: "PENDING", label: "Đang chờ", icon: "⏳" },
            { v: "APPROVED", label: "Đã duyệt", icon: "✅" },
            { v: "REJECTED", label: "Từ chối", icon: "❌" },
          ] as { v: Tab; label: string; icon: string }[]
        ).map((t) => (
          <button
            key={t.v}
            onClick={() => setTab(t.v)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              tab === t.v
                ? "bg-brand-600 text-white shadow-lg shadow-brand-600/30"
                : "text-white/60 hover:text-white"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {!loaded &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl bg-white/5 shimmer" />
          ))}
        {loaded && rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-10 text-center text-white/60">
            Không có yêu cầu {tab === "PENDING" ? "đang chờ" : tab === "APPROVED" ? "đã duyệt" : "bị từ chối"}.
          </div>
        )}
        {rows.map((req) => (
          <div
            key={req.id}
            className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-5 transition hover:border-white/20"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-xl font-bold">{req.restaurantName}</h3>
                  <PlanChip tier={req.planRequested} />
                  <StatusChip status={req.status} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/60">
                  <span>
                    /<span className="font-mono">{req.slug}</span>
                  </span>
                  <span>·</span>
                  <span>
                    Gửi {new Date(req.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-white/80 md:grid-cols-2">
                  <Info label="Chủ quán" value={req.adminName} />
                  <Info label="Email" value={req.adminEmail} />
                  {req.phone && <Info label="Điện thoại" value={req.phone} />}
                  {req.address && <Info label="Địa chỉ" value={req.address} />}
                </div>
                {req.note && (
                  <div className="mt-2 rounded-xl bg-white/5 p-3 text-sm text-white/70">
                    <span className="text-[10px] uppercase tracking-widest text-white/50">
                      Ghi chú
                    </span>
                    <div className="mt-0.5 italic">{req.note}</div>
                  </div>
                )}
                {req.rejectReason && (
                  <div className="mt-2 rounded-xl bg-red-500/15 p-3 text-sm text-red-200">
                    Lý do từ chối: {req.rejectReason}
                  </div>
                )}
              </div>

              {req.status === "PENDING" && (
                <div className="flex w-full flex-col gap-2 md:w-64">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-white/50">
                      Gói khi duyệt
                    </div>
                    <div className="mt-1">
                      <Select
                        value={planOverride[req.id] ?? req.planRequested}
                        onChange={(v) =>
                          setPlanOverride((p) => ({ ...p, [req.id]: v }))
                        }
                        options={PLAN_OPTIONS}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => approve(req)}
                    disabled={busyId === req.id}
                    className="flex items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-semibold text-white shadow-lg shadow-green-600/30 hover:bg-green-500 disabled:opacity-50"
                  >
                    {busyId === req.id && <Spinner className="h-4 w-4" />}
                    {busyId === req.id ? "Đang duyệt..." : "✓ Duyệt & tạo cửa hàng"}
                  </button>
                  <button
                    onClick={() => reject(req)}
                    disabled={busyId === req.id}
                    className="rounded-xl border border-red-400/40 bg-red-500/10 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    Từ chối
                  </button>
                </div>
              )}

              {req.status === "APPROVED" && req.createdRestaurantId && (
                <a
                  href={`/superadmin/restaurants/${req.createdRestaurantId}`}
                  className="inline-flex items-center gap-1 self-start rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                >
                  Xem cửa hàng →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-white/50">{label}</div>
      <div className="truncate">{value}</div>
    </div>
  );
}

function PlanChip({ tier }: { tier: string }) {
  const map: Record<string, string> = {
    TRIAL: "bg-amber-500/20 text-amber-300",
    STARTER: "bg-green-500/20 text-green-300",
    PRO: "bg-brand-500/30 text-brand-200",
    ENTERPRISE: "bg-purple-500/20 text-purple-200",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${map[tier]}`}>
      {tier}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    PENDING: "bg-amber-500/20 text-amber-300",
    APPROVED: "bg-green-500/20 text-green-300",
    REJECTED: "bg-red-500/20 text-red-300",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${map[status]}`}>
      {status}
    </span>
  );
}
