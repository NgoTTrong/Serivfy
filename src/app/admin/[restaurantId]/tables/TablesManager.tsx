"use client";

import { useEffect, useState } from "react";
import { useDialog } from "@/components/DialogProvider";
import { Spinner } from "@/components/Spinner";

type Table = {
  id: string;
  number: number;
  label: string;
  capacity: number;
  qrToken: string;
  isActive: boolean;
};

export default function TablesManager() {
  const dialog = useDialog();
  const [tables, setTables] = useState<Table[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [previewQr, setPreviewQr] = useState<Table | null>(null);
  const [editing, setEditing] = useState<Table | null>(null);

  async function load() {
    const r = await fetch("/api/admin/tables");
    if (r.ok) setTables((await r.json()).tables || []);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  async function remove(t: Table) {
    const ok = await dialog.confirm({
      icon: "🗑️",
      title: `Xoá ${t.label}?`,
      message: "Bàn và mã QR sẽ bị huỷ. Sessions trong quá khứ vẫn giữ lại.",
      confirmLabel: "Xoá bàn",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/tables/${t.id}`, { method: "DELETE" });
    dialog.toast({ message: `Đã xoá ${t.label}`, type: "success" });
    load();
  }
  async function toggleActive(t: Table) {
    await fetch(`/api/admin/tables/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !t.isActive }),
    });
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">Bàn & QR</h1>
          <p className="text-sm text-ink-500">Quản lý bàn — tạo & tải QR code in dán</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Thêm bàn
        </button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {!loaded &&
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-40 rounded-2xl border border-ink-100 bg-white shimmer"
            />
          ))}
        {loaded &&
          tables.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-ink-200 p-10 text-center text-ink-500">
              Chưa có bàn nào. Bấm “+ Thêm bàn” để tạo.
            </div>
          )}
        {loaded && tables.map((t) => (
          <div
            key={t.id}
            className={`group relative overflow-hidden rounded-2xl border bg-white p-5 transition hover:shadow-lg ${
              t.isActive ? "border-ink-100 hover:border-brand-200" : "border-red-200 bg-red-50/20"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-14 w-14 flex-none items-center justify-center rounded-2xl font-display text-2xl font-bold ${
                    t.isActive
                      ? "bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700"
                      : "bg-ink-100 text-ink-500"
                  }`}
                >
                  {t.number}
                </div>
                <div>
                  <div className="font-display text-xl font-bold leading-tight">{t.label}</div>
                  <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-500">
                    <span>👥</span>
                    <span>{t.capacity} khách</span>
                  </div>
                </div>
              </div>
              {!t.isActive && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  Tạm tắt
                </span>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setPreviewQr(t)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink-950 py-2.5 text-sm font-semibold text-white hover:bg-ink-800"
              >
                <span>🔍</span>
                <span>Xem QR</span>
              </button>
              <a
                href={`/api/admin/tables/${t.id}/qr?format=png`}
                download
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-ink-300 py-2.5 text-center text-sm font-semibold hover:bg-ink-50"
              >
                <span>⬇️</span>
                <span>Tải PNG</span>
              </a>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-3 text-xs">
              <button
                onClick={() => setEditing(t)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-ink-700 hover:bg-ink-100"
              >
                ✏️ Sửa
              </button>
              <button
                onClick={() => toggleActive(t)}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium ${
                  t.isActive
                    ? "text-ink-600 hover:bg-ink-100"
                    : "text-green-700 hover:bg-green-50"
                }`}
              >
                {t.isActive ? "⏸️ Tạm tắt" : "▶️ Bật lại"}
              </button>
              <button
                onClick={() => remove(t)}
                className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-medium text-red-600 hover:bg-red-50"
              >
                🗑️ Xoá
              </button>
            </div>
          </div>
        ))}
      </div>

      {showNew && <NewTable onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {editing && (
        <EditTable
          table={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
      {previewQr && <QrPreview table={previewQr} onClose={() => setPreviewQr(null)} />}
    </div>
  );
}

function EditTable({
  table,
  onClose,
  onSaved,
}: {
  table: Table;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dialog = useDialog();
  const [num, setNum] = useState(String(table.number));
  const [label, setLabel] = useState(table.label);
  const [capacity, setCapacity] = useState(String(table.capacity));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setErr("");
    if (!label.trim() || !num || Number(num) < 1 || Number(capacity) < 1) {
      setErr("Thông tin không hợp lệ");
      return;
    }
    setBusy(true);
    const r = await fetch(`/api/admin/tables/${table.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: Number(num),
        label: label.trim(),
        capacity: Number(capacity),
      }),
    });
    setBusy(false);
    if (r.ok) {
      dialog.toast({ message: `Đã cập nhật ${label}`, type: "success" });
      onSaved();
    } else {
      setErr("Không lưu được — số bàn có thể bị trùng");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">Sửa bàn</h2>
            <p className="text-sm text-ink-500">QR token giữ nguyên — không cần in lại.</p>
          </div>
          <button
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-100 text-ink-700 hover:bg-ink-200"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-ink-500">
              Nhãn bàn
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ví dụ: Bàn 5 · VIP 2 · Sảnh A"
              className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                Số bàn
              </label>
              <input
                type="number"
                value={num}
                onChange={(e) => setNum(e.target.value)}
                min={1}
                className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-ink-500">
                Sức chứa
              </label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                min={1}
                max={50}
                className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>
        </div>

        {err && (
          <div className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl bg-ink-100 px-4 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-200"
          >
            Huỷ
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-600/30 hover:bg-brand-700 disabled:opacity-50"
          >
            {busy && <Spinner className="h-4 w-4" />}
            {busy ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewTable({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const dialog = useDialog();
  const [num, setNum] = useState("");
  const [label, setLabel] = useState("");
  const [capacity, setCapacity] = useState("4");
  const [err, setErr] = useState("");
  async function save() {
    setErr("");
    const r = await fetch("/api/admin/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: Number(num),
        label: label || `Bàn ${num}`,
        capacity: Number(capacity),
      }),
    });
    if (r.ok) {
      dialog.toast({ message: "Đã thêm bàn", type: "success" });
      onSaved();
    } else {
      setErr("Số bàn đã tồn tại hoặc không hợp lệ");
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="font-display text-2xl font-bold">Thêm bàn mới</h2>
        <div className="mt-4 space-y-3">
          <input
            type="number"
            value={num}
            onChange={(e) => setNum(e.target.value)}
            placeholder="Số bàn"
            className="w-full rounded-xl border border-ink-200 px-4 py-3"
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={`Nhãn (vd: Bàn VIP ${num || "1"})`}
            className="w-full rounded-xl border border-ink-200 px-4 py-3"
          />
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Sức chứa"
            className="w-full rounded-xl border border-ink-200 px-4 py-3"
          />
        </div>
        {err && (
          <div className="mt-3 rounded-xl bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-ink-600">
            Huỷ
          </button>
          <button onClick={save} className="rounded-xl bg-brand-600 px-4 py-2 text-white">
            Thêm
          </button>
        </div>
      </div>
    </div>
  );
}

function QrPreview({ table, onClose }: { table: Table; onClose: () => void }) {
  const [errored, setErrored] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-w-sm rounded-3xl bg-white p-8 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-2xl font-bold">{table.label}</h2>
        <p className="text-sm text-ink-500">Quét để vào menu</p>
        <div className="mt-4 rounded-2xl border border-ink-100 bg-white p-4">
          {errored ? (
            <div className="flex h-64 w-64 flex-col items-center justify-center rounded-xl bg-ink-50 text-ink-500">
              <div className="text-4xl">⚠️</div>
              <p className="mt-2 text-sm">Không tải được QR</p>
              <button
                onClick={() => setErrored(false)}
                className="mt-2 rounded-full bg-ink-950 px-3 py-1 text-xs font-semibold text-white"
              >
                Thử lại
              </button>
            </div>
          ) : (
            <img
              src={`/api/admin/tables/${table.id}/qr?format=svg`}
              alt={`QR ${table.label}`}
              className="h-64 w-64"
              onError={() => setErrored(true)}
            />
          )}
        </div>
        <div className="mt-4 flex justify-center gap-2">
          <a
            href={`/api/admin/tables/${table.id}/qr?format=png`}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white"
          >
            Tải PNG
          </a>
          <a
            href={`/api/admin/tables/${table.id}/qr?format=svg`}
            className="rounded-full border border-ink-300 px-5 py-2 text-sm font-semibold"
          >
            Tải SVG
          </a>
        </div>
      </div>
    </div>
  );
}
