"use client";

import { useEffect, useState } from "react";
import { useDialog } from "@/components/DialogProvider";
import { Select } from "@/components/Select";

type Staff = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "WAITER" | "KITCHEN";
  createdAt: string;
};

export default function StaffManager() {
  const dialog = useDialog();
  const [list, setList] = useState<Staff[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/staff");
    if (r.ok) setList((await r.json()).staff || []);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(s: Staff) {
    const ok = await dialog.confirm({
      icon: "🗑️",
      title: `Xoá ${s.name}?`,
      message: `Tài khoản ${s.email} sẽ không thể đăng nhập được nữa.`,
      confirmLabel: "Xoá tài khoản",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/staff/${s.id}`, { method: "DELETE" });
    dialog.toast({ message: `Đã xoá ${s.name}`, type: "success" });
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">Nhân viên</h1>
          <p className="text-sm text-ink-500">Quản lý tài khoản & phân quyền</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <span className="sm:hidden">+ Thêm</span>
          <span className="hidden sm:inline">+ Thêm nhân viên</span>
        </button>
      </div>

      {/* Role summary */}
      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        {(["ADMIN", "WAITER", "KITCHEN"] as const).map((role) => {
          const count = list.filter((s) => s.role === role).length;
          const cfg = ROLE_CFG[role];
          return (
            <div
              key={role}
              className="rounded-2xl border border-ink-100 bg-white p-3 sm:p-4"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span
                  className={`inline-flex h-9 w-9 flex-none items-center justify-center rounded-xl text-lg sm:h-10 sm:w-10 sm:text-xl ${cfg.cls}`}
                >
                  {cfg.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-[10px] text-ink-500 sm:text-xs">{cfg.label}</div>
                  {loaded ? (
                    <div className="font-display text-xl font-bold sm:text-2xl">{count}</div>
                  ) : (
                    <div className="mt-1 h-6 w-8 rounded bg-ink-100 shimmer sm:h-7 sm:w-10" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Staff grid */}
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {!loaded &&
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-4"
            >
              <div className="h-14 w-14 flex-none rounded-2xl bg-ink-100 shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-2/3 rounded bg-ink-100 shimmer" />
                <div className="h-3 w-1/2 rounded bg-ink-100 shimmer" />
                <div className="h-3 w-24 rounded bg-ink-100 shimmer" />
              </div>
            </div>
          ))}
        {loaded && list.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-ink-200 bg-white p-10 text-center text-ink-500">
            Chưa có nhân viên nào — bấm{" "}
            <span className="font-semibold text-brand-700">+ Thêm nhân viên</span> để bắt đầu.
          </div>
        )}
        {list.map((s) => {
          const cfg = ROLE_CFG[s.role];
          const initial = s.name.trim().charAt(0).toUpperCase() || "?";
          return (
            <div
              key={s.id}
              className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-4 transition hover:border-brand-200 hover:shadow-md"
            >
              <div
                className={`flex h-14 w-14 flex-none items-center justify-center rounded-2xl font-display text-2xl font-bold text-white ${cfg.avatarBg}`}
              >
                {initial}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-semibold">{s.name}</span>
                  <RoleBadge role={s.role} />
                </div>
                <div className="truncate text-sm text-ink-500">{s.email}</div>
                <div className="text-[11px] text-ink-400">
                  Tạo {new Date(s.createdAt).toLocaleDateString("vi-VN")}
                </div>
              </div>
              <button
                onClick={() => remove(s)}
                title="Xoá"
                aria-label="Xoá"
                className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full text-ink-400 transition hover:bg-red-50 hover:text-red-600"
              >
                🗑️
              </button>
            </div>
          );
        })}
      </div>

      {showNew && (
        <NewStaff
          onClose={() => setShowNew(false)}
          onSaved={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

const ROLE_CFG = {
  ADMIN: {
    label: "Quản lý",
    icon: "👑",
    cls: "bg-brand-100 text-brand-700",
    avatarBg: "bg-gradient-to-br from-brand-500 to-brand-700",
  },
  WAITER: {
    label: "Phục vụ",
    icon: "🛎️",
    cls: "bg-blue-100 text-blue-700",
    avatarBg: "bg-gradient-to-br from-blue-500 to-blue-700",
  },
  KITCHEN: {
    label: "Bếp",
    icon: "🍳",
    cls: "bg-amber-100 text-amber-800",
    avatarBg: "bg-gradient-to-br from-amber-500 to-amber-700",
  },
} as const;

function RoleBadge({ role }: { role: "ADMIN" | "WAITER" | "KITCHEN" }) {
  const r = ROLE_CFG[role];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.cls}`}
    >
      <span>{r.icon}</span>
      {r.label}
    </span>
  );
}

function NewStaff({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "WAITER" | "KITCHEN">("WAITER");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  async function save() {
    setErr("");
    const r = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, role, password }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => null);
      setErr(d?.error === "EMAIL_TAKEN" ? "Email đã tồn tại" : "Không tạo được");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="font-display text-2xl font-bold">Nhân viên mới</h2>
        <div className="mt-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Họ tên"
            className="w-full rounded-xl border border-ink-200 px-4 py-3"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            className="w-full rounded-xl border border-ink-200 px-4 py-3"
          />
          <Select
            value={role}
            onChange={(v) => setRole(v as "ADMIN" | "WAITER" | "KITCHEN")}
            options={[
              { value: "WAITER", label: "Phục vụ", icon: "🛎️", sub: "Tick món đã mang ra, đóng bàn" },
              { value: "KITCHEN", label: "Bếp", icon: "🍳", sub: "Xem đơn đang nấu (KDS)" },
              { value: "ADMIN", label: "Quản lý", icon: "👑", sub: "Full quyền — menu, bàn, nhân viên" },
            ]}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu (>=6 ký tự)"
            type="password"
            className="w-full rounded-xl border border-ink-200 px-4 py-3"
          />
        </div>
        {err && <div className="mt-3 text-sm text-red-600">{err}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-ink-600">
            Hủy
          </button>
          <button onClick={save} className="rounded-xl bg-brand-600 px-4 py-2 text-white">
            Thêm
          </button>
        </div>
      </div>
    </div>
  );
}
