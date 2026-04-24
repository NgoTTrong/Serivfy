"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDialog } from "@/components/DialogProvider";
import { formatVND } from "@/lib/format";

type Choice = { id?: string; label: string; priceDelta: number };
type Template = {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  order: number;
  choices: Choice[];
  _count: { appliedTo: number };
};

type Draft = {
  id?: string;
  name: string;
  required: boolean;
  multiple: boolean;
  choices: Choice[];
};

export default function ModifierLibrary() {
  const dialog = useDialog();
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params?.restaurantId ?? "";
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/modifiers");
    if (r.ok) setTemplates((await r.json()).templates || []);
    setLoaded(true);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(draft: Draft) {
    if (!draft.name.trim()) {
      dialog.toast({ message: "Nhập tên nhóm", type: "error" });
      return;
    }
    if (draft.choices.length === 0 || draft.choices.some((c) => !c.label.trim())) {
      dialog.toast({ message: "Thêm ít nhất 1 lựa chọn hợp lệ", type: "error" });
      return;
    }
    const body = {
      name: draft.name.trim(),
      required: draft.required,
      multiple: draft.multiple,
      choices: draft.choices.map((c) => ({
        label: c.label.trim(),
        priceDelta: c.priceDelta,
      })),
    };
    const r = draft.id
      ? await fetch(`/api/admin/modifiers/${draft.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/admin/modifiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    if (!r.ok) {
      dialog.toast({ message: "Lỗi lưu", type: "error" });
      return;
    }
    dialog.toast({ message: "Đã lưu", type: "success" });
    setEditing(null);
    load();
  }

  async function remove(t: Template) {
    const ok = await dialog.confirm({
      icon: "🗑️",
      title: `Xoá "${t.name}"?`,
      message:
        t._count.appliedTo > 0
          ? `Đang áp cho ${t._count.appliedTo} món — sẽ tháo khỏi các món đó.`
          : "Xoá nhóm?",
      confirmLabel: "Xoá",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/modifiers/${t.id}`, { method: "DELETE" });
    dialog.toast({ message: "Đã xoá", type: "success" });
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <nav className="mb-4 text-sm text-ink-500">
        <Link href={`/admin/${restaurantId}/menu`} className="hover:text-brand-600">
          ← Thực đơn
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">
            Thư viện tuỳ chọn dùng chung
          </h1>
          <p className="text-sm text-ink-500">
            Định nghĩa 1 lần — áp cho nhiều món. Sửa ở đây, mọi món đang dùng tự cập nhật.
          </p>
        </div>
        <button
          onClick={() =>
            setEditing({
              name: "",
              required: false,
              multiple: false,
              choices: [{ label: "", priceDelta: 0 }],
            })
          }
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Thêm nhóm
        </button>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {!loaded &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl border border-ink-100 bg-white shimmer" />
          ))}
        {loaded && templates.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-ink-200 p-10 text-center text-ink-500">
            Chưa có nhóm tuỳ chọn dùng chung. Ví dụ điển hình:{" "}
            <strong>Size (S/M/L)</strong>, <strong>Độ ngọt (0%/50%/100%)</strong>,{" "}
            <strong>Topping (trân châu +5k, pudding +10k)</strong>.
          </div>
        )}
        {templates.map((t) => (
          <div key={t.id} className="rounded-2xl border border-ink-100 bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-display text-lg font-bold">{t.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {t.required && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      Bắt buộc
                    </span>
                  )}
                  {t.multiple && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                      Chọn nhiều
                    </span>
                  )}
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
                    Áp {t._count.appliedTo} món
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              {t.choices.slice(0, 5).map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-ink-50 px-2 py-1 text-xs"
                >
                  <span>{c.label}</span>
                  <span className="font-mono text-ink-500">
                    {c.priceDelta > 0
                      ? `+${formatVND(c.priceDelta)}`
                      : c.priceDelta < 0
                        ? formatVND(c.priceDelta)
                        : "—"}
                  </span>
                </div>
              ))}
              {t.choices.length > 5 && (
                <div className="text-xs text-ink-400">…và {t.choices.length - 5} nữa</div>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() =>
                  setEditing({
                    id: t.id,
                    name: t.name,
                    required: t.required,
                    multiple: t.multiple,
                    choices: t.choices.map((c) => ({
                      label: c.label,
                      priceDelta: c.priceDelta,
                    })),
                  })
                }
                className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50"
              >
                Sửa
              </button>
              <button
                onClick={() => remove(t)}
                className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700"
              >
                Xoá
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditDialog draft={editing} onClose={() => setEditing(null)} onSave={save} />
      )}
    </div>
  );
}

function EditDialog({
  draft,
  onClose,
  onSave,
}: {
  draft: Draft;
  onClose: () => void;
  onSave: (d: Draft) => void;
}) {
  const [d, setD] = useState<Draft>(draft);

  function update(patch: Partial<Draft>) {
    setD({ ...d, ...patch });
  }
  function updateChoice(i: number, patch: Partial<Choice>) {
    setD({ ...d, choices: d.choices.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  }
  function addChoice() {
    setD({ ...d, choices: [...d.choices, { label: "", priceDelta: 0 }] });
  }
  function removeChoice(i: number) {
    setD({ ...d, choices: d.choices.filter((_, j) => j !== i) });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="font-display text-xl font-bold">
          {draft.id ? "Sửa nhóm" : "Nhóm mới"}
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-semibold">Tên nhóm</span>
            <input
              value={d.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Size / Topping / Độ ngọt"
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
            />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.required}
                onChange={(e) => update({ required: e.target.checked })}
              />
              <span>Bắt buộc chọn</span>
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.multiple}
                onChange={(e) => update({ multiple: e.target.checked })}
              />
              <span>Cho chọn nhiều</span>
            </label>
          </div>

          <div className="pt-2">
            <div className="mb-2 text-sm font-semibold">Lựa chọn</div>
            <div className="space-y-2">
              {d.choices.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={c.label}
                    onChange={(e) => updateChoice(i, { label: e.target.value })}
                    placeholder="Nhãn (VD: Size L)"
                    className="flex-1 rounded-lg border border-ink-200 px-3 py-1.5 text-sm"
                  />
                  <span className="text-xs text-ink-500">+VND</span>
                  <input
                    type="number"
                    value={c.priceDelta}
                    onChange={(e) =>
                      updateChoice(i, { priceDelta: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-28 rounded-lg border border-ink-200 px-2 py-1.5 font-mono text-sm"
                  />
                  <button
                    onClick={() => removeChoice(i)}
                    disabled={d.choices.length <= 1}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:text-ink-300"
                  >
                    Xoá
                  </button>
                </div>
              ))}
              <button
                onClick={addChoice}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                + Thêm lựa chọn
              </button>
            </div>
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
            onClick={() => onSave(d)}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
