"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useDialog } from "@/components/DialogProvider";
import { Select } from "@/components/Select";
import { Spinner } from "@/components/Spinner";
import { formatVND } from "@/lib/format";

type Staff = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
};

type Detail = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    address: string | null;
    status: "ACTIVE" | "SUSPENDED" | "EXPIRED";
    planTier: "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE";
    trialEndsAt: string | null;
    approvedAt: string | null;
    suspendedAt: string | null;
    suspendReason: string | null;
    createdAt: string;
    staff: Staff[];
    _count: { tables: number; menuItems: number; sessions: number; categories: number };
  };
  revenueTodayVND: number;
  lifetimeRevenueVND: number;
};

const PLAN_OPTIONS = [
  { value: "TRIAL", label: "Trial (14 ngày)", icon: "🎁" },
  { value: "STARTER", label: "Starter — 199k/tháng", icon: "🌱" },
  { value: "PRO", label: "Pro — 499k/tháng", icon: "⭐" },
  { value: "ENTERPRISE", label: "Enterprise", icon: "🏢" },
];

export default function DetailClient({ id }: { id: string }) {
  const router = useRouter();
  const dialog = useDialog();
  const [data, setData] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [planDraft, setPlanDraft] = useState<string>("TRIAL");

  async function load() {
    const r = await fetch(`/api/platform/restaurants/${id}`);
    if (r.ok) setData(await r.json());
  }
  useEffect(() => {
    load();
  }, [id]);

  async function patch(body: Record<string, unknown>, successMsg: string) {
    setBusy(true);
    const r = await fetch(`/api/platform/restaurants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (r.ok) {
      dialog.toast({ message: successMsg, type: "success" });
      load();
    } else {
      dialog.toast({ message: "Không cập nhật được", type: "error" });
    }
  }

  function openChangePlan() {
    if (!data) return;
    setPlanDraft(data.restaurant.planTier);
    setShowPlan(true);
  }
  async function confirmChangePlan() {
    if (!data) return;
    if (planDraft === data.restaurant.planTier) {
      setShowPlan(false);
      return;
    }
    setShowPlan(false);
    await patch({ planTier: planDraft }, `Đã đổi sang gói ${planDraft}`);
  }

  async function suspend() {
    if (!data) return;
    const ok = await dialog.confirm({
      icon: "⏸️",
      title: `Đình chỉ ${data.restaurant.name}?`,
      message:
        "Toàn bộ staff của quán sẽ không đăng nhập được. Khách vẫn thấy thông báo phiên đã đóng.",
      confirmLabel: "Đình chỉ",
      danger: true,
    });
    if (!ok) return;
    patch(
      { status: "SUSPENDED", suspendReason: "Đình chỉ bởi Servify HQ" },
      "Đã đình chỉ",
    );
  }

  async function activate() {
    patch({ status: "ACTIVE" }, "Đã kích hoạt lại");
  }

  async function extendTrial() {
    patch({ extendTrialDays: 14 }, "Gia hạn 14 ngày dùng thử");
  }

  async function impersonate() {
    if (!data) return;
    const ok = await dialog.confirm({
      icon: "🎭",
      title: `Đăng nhập với tư cách Admin của ${data.restaurant.name}?`,
      message:
        "Bạn sẽ thấy đúng những gì chủ quán thấy. Mọi hành động được ghi vào audit log.",
      confirmLabel: "Impersonate",
    });
    if (!ok) return;
    const r = await fetch(`/api/platform/restaurants/${id}/impersonate`, {
      method: "POST",
    });
    if (!r.ok) {
      dialog.toast({ message: "Không impersonate được", type: "error" });
      return;
    }
    const d = await r.json();
    router.push(d.redirectTo);
  }

  if (!data) {
    return (
      <div className="p-6 md:p-10">
        <div className="h-12 w-64 rounded bg-white/10 shimmer" />
        <div className="mt-6 h-96 rounded-2xl bg-white/10 shimmer" />
      </div>
    );
  }

  const r = data.restaurant;
  const trialLeft =
    r.trialEndsAt && r.planTier === "TRIAL"
      ? Math.max(0, Math.ceil((new Date(r.trialEndsAt).getTime() - Date.now()) / 86400000))
      : null;

  return (
    <div className="p-6 md:p-10">
      <Link
        href="/superadmin/restaurants"
        className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"
      >
        ← Quay về danh sách
      </Link>

      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">{r.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-mono text-white/60">{r.slug}</span>
            <StatusChip status={r.status} />
            <PlanChip tier={r.planTier} />
          </div>
          <div className="mt-1 text-xs text-white/50">
            Tạo {new Date(r.createdAt).toLocaleString("vi-VN")}
            {r.approvedAt && ` · Duyệt ${new Date(r.approvedAt).toLocaleDateString("vi-VN")}`}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={impersonate}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
          >
            🎭 Impersonate
          </button>
          <button
            onClick={openChangePlan}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
          >
            {busy && <Spinner className="h-3.5 w-3.5" />}
            Đổi plan
          </button>
          {r.planTier === "TRIAL" && (
            <button
              onClick={extendTrial}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {busy && <Spinner className="h-3.5 w-3.5" />}
              Gia hạn +14 ngày
            </button>
          )}
          {r.status === "ACTIVE" ? (
            <button
              onClick={suspend}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/30 disabled:opacity-50"
            >
              {busy && <Spinner className="h-3.5 w-3.5" />}
              Đình chỉ
            </button>
          ) : (
            <button
              onClick={activate}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-4 py-2 text-sm font-semibold text-green-200 hover:bg-green-500/30 disabled:opacity-50"
            >
              {busy && <Spinner className="h-3.5 w-3.5" />}
              Kích hoạt lại
            </button>
          )}
        </div>
      </div>

      {r.suspendReason && (
        <div className="mt-4 rounded-xl bg-red-500/15 p-3 text-sm text-red-200">
          Đình chỉ: {r.suspendReason}
        </div>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card label="Bàn" value={r._count.tables} icon="🪑" />
        <Card label="Món" value={r._count.menuItems} icon="🍽️" />
        <Card label="Nhân viên" value={r.staff.length} icon="👥" />
        <Card label="Lịch sử session" value={r._count.sessions} icon="🧾" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-display text-xl font-bold">Doanh thu</h2>
          <div className="mt-4 flex items-baseline justify-between">
            <div>
              <div className="text-xs text-white/60">Hôm nay</div>
              <div className="font-display text-2xl font-bold">
                {formatVND(data.revenueTodayVND)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/60">Tổng đã thanh toán</div>
              <div className="font-display text-2xl font-bold">
                {formatVND(data.lifetimeRevenueVND)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="font-display text-xl font-bold">Thông tin liên hệ</h2>
          <div className="mt-4 space-y-1 text-sm">
            {r.phone && <div><span className="text-white/50">ĐT: </span>{r.phone}</div>}
            {r.address && <div><span className="text-white/50">Địa chỉ: </span>{r.address}</div>}
            {trialLeft !== null && (
              <div className="mt-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs text-amber-200">
                ⏳ Còn <span className="font-bold">{trialLeft} ngày</span> dùng thử
                {r.trialEndsAt && ` (hết ${new Date(r.trialEndsAt).toLocaleDateString("vi-VN")})`}
              </div>
            )}
          </div>
        </div>
      </div>

      {showPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShowPlan(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 text-ink-950 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-xl font-bold">Đổi plan cho {r.name}</h3>
            <p className="mt-1 text-sm text-ink-500">
              Thay đổi gói tức thì — feature gate áp dụng ngay.
            </p>
            <div className="mt-4">
              <Select
                value={planDraft}
                onChange={setPlanDraft}
                options={PLAN_OPTIONS}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowPlan(false)}
                className="rounded-xl bg-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-200"
              >
                Huỷ
              </button>
              <button
                onClick={confirmChangePlan}
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/30 hover:bg-brand-700"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-display text-xl font-bold">Nhân viên ({r.staff.length})</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-white/5">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-white/50">
              <tr>
                <th className="px-4 py-2 text-left">Tên</th>
                <th className="px-4 py-2 text-left">Email</th>
                <th className="px-4 py-2 text-left">Vai trò</th>
                <th className="px-4 py-2 text-left">Tạo</th>
              </tr>
            </thead>
            <tbody>
              {r.staff.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-white/70">{s.email}</td>
                  <td className="px-4 py-2 text-xs">
                    <span className="rounded-full bg-white/10 px-2 py-0.5">{s.role}</span>
                  </td>
                  <td className="px-4 py-2 text-xs text-white/60">
                    {new Date(s.createdAt).toLocaleDateString("vi-VN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | undefined;
  icon: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-white/60">
          {label}
        </div>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-base">
          {icon}
        </span>
      </div>
      <div className="mt-2 font-display text-3xl font-bold">{value ?? "—"}</div>
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
    ACTIVE: "bg-green-500/20 text-green-300",
    SUSPENDED: "bg-red-500/20 text-red-300",
    EXPIRED: "bg-amber-500/20 text-amber-300",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${map[status]}`}>
      {status}
    </span>
  );
}
