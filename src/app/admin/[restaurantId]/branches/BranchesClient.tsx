"use client";

import { useCallback, useEffect, useState } from "react";
import { useDialog } from "@/components/DialogProvider";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  timezone: string | null;
  isActive: boolean;
  _count: { tables: number; staff: number };
};

export default function BranchesClient() {
  const dialog = useDialog();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/branches");
    if (r.ok) setBranches((await r.json()).branches || []);
    setLoaded(true);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function toggleActive(b: Branch) {
    await fetch(`/api/admin/branches/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !b.isActive }),
    });
    load();
  }

  async function remove(b: Branch) {
    const hasHistory = b._count.tables > 0 || b._count.staff > 0;
    const ok = await dialog.confirm({
      icon: "🗑️",
      title: `Xoá "${b.name}"?`,
      message: hasHistory
        ? `Đang có ${b._count.tables} bàn + ${b._count.staff} nhân viên — sẽ chỉ tắt, không xoá hẳn.`
        : "Chi nhánh chưa có dữ liệu, xoá hẳn?",
      confirmLabel: "OK",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/branches/${b.id}`, { method: "DELETE" });
    dialog.toast({ message: "Đã xử lý", type: "success" });
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">
            Chi nhánh
          </h1>
          <p className="text-sm text-ink-500">
            Quản lý nhiều điểm bán của quán. Enterprise mới mở được &gt; 1 chi nhánh.
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Thêm chi nhánh
        </button>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {!loaded &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-ink-100 bg-white shimmer" />
          ))}
        {loaded &&
          branches.map((b) => (
            <div
              key={b.id}
              className={`rounded-2xl border bg-white p-4 ${
                b.isActive ? "border-ink-100" : "border-ink-200 bg-ink-50 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-lg font-bold">{b.name}</div>
                  {b.address && <div className="text-xs text-ink-500">{b.address}</div>}
                  {b.phone && <div className="text-xs text-ink-500">📞 {b.phone}</div>}
                </div>
                {!b.isActive && (
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
                    tắt
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-4 text-xs text-ink-600">
                <span>🪑 {b._count.tables} bàn</span>
                <span>👥 {b._count.staff} nhân viên</span>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setEditing(b)}
                  className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                >
                  Sửa
                </button>
                <button
                  onClick={() => toggleActive(b)}
                  className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                >
                  {b.isActive ? "Tắt" : "Bật"}
                </button>
                <button
                  onClick={() => remove(b)}
                  className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Xoá
                </button>
              </div>
            </div>
          ))}
      </div>

      {(showNew || editing) && (
        <BranchDialog
          branch={editing}
          onClose={() => {
            setShowNew(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowNew(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function BranchDialog({
  branch,
  onClose,
  onSaved,
}: {
  branch: Branch | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useDialog();
  const [name, setName] = useState(branch?.name ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [phone, setPhone] = useState(branch?.phone ?? "");
  const [timezone, setTimezone] = useState(branch?.timezone ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    if (!name.trim()) return;
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        address: address || null,
        phone: phone || null,
        timezone: timezone || null,
      };
      const r = branch
        ? await fetch(`/api/admin/branches/${branch.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/branches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        dialog.toast({
          message: d.message || "Lỗi lưu",
          type: "error",
        });
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="font-display text-xl font-bold">
          {branch ? "Sửa chi nhánh" : "Chi nhánh mới"}
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-semibold">Tên</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Chi nhánh Hai Bà Trưng"
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Địa chỉ</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-semibold">SĐT</span>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Timezone (tùy chọn)</span>
              <input
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Ho_Chi_Minh"
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
              />
            </label>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Huỷ
          </button>
          <button
            onClick={save}
            disabled={busy || !name.trim()}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-ink-300"
          >
            {busy ? "..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
