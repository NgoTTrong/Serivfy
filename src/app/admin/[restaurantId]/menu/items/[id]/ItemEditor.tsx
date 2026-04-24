"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useDialog } from "@/components/DialogProvider";
import { Select } from "@/components/Select";
import { SafeImg } from "@/components/SafeImg";
import { formatVND } from "@/lib/format";

type OptionChoice = { id?: string; label: string; priceDelta: number };
type OptionGroup = {
  id?: string;
  name: string;
  required: boolean;
  multiple: boolean;
  choices: OptionChoice[];
};
type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  isAvailable: boolean;
  categoryId: string;
  stationId: string | null;
  optionGroups: OptionGroup[];
  attachedTemplateIds: string[];
};

type TemplatePreview = {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  choices: Array<{ label: string; priceDelta: number }>;
};

type Tab = "info" | "options" | "templates";

export default function ItemEditor({
  restaurantId,
  item,
  categories,
  stations,
  allTemplates,
}: {
  restaurantId: string;
  item: Item;
  categories: Array<{ id: string; name: string }>;
  stations: Array<{ id: string; name: string }>;
  allTemplates: TemplatePreview[];
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [tab, setTab] = useState<Tab>("info");
  const [current, setCurrent] = useState<Item>(item);

  // Track dirty flags per tab so "Save" only writes what changed.
  const [infoDirty, setInfoDirty] = useState(false);
  const [optionsDirty, setOptionsDirty] = useState(false);
  const [attachedIds, setAttachedIds] = useState<string[]>(item.attachedTemplateIds);
  const [templatesDirty, setTemplatesDirty] = useState(false);

  async function saveTemplates() {
    const r = await fetch(`/api/admin/menu-items/${current.id}/modifiers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateIds: attachedIds }),
    });
    if (!r.ok) {
      dialog.toast({ message: "Lỗi lưu nhóm dùng chung", type: "error" });
      return;
    }
    dialog.toast({ message: "Đã cập nhật nhóm dùng chung", type: "success" });
    setTemplatesDirty(false);
    router.refresh();
  }

  function toggleAttach(id: string) {
    setAttachedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setTemplatesDirty(true);
  }

  function patchInfo<K extends keyof Item>(k: K, v: Item[K]) {
    setCurrent((prev) => ({ ...prev, [k]: v }));
    setInfoDirty(true);
  }

  async function saveInfo() {
    const r = await fetch(`/api/admin/menu-items/${current.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: current.name,
        description: current.description,
        price: current.price,
        categoryId: current.categoryId,
        image: current.image || null,
        stationId: current.stationId || null,
        isAvailable: current.isAvailable,
      }),
    });
    if (!r.ok) {
      dialog.toast({ message: "Lỗi lưu", type: "error" });
      return;
    }
    dialog.toast({ message: "Đã lưu thông tin", type: "success" });
    setInfoDirty(false);
    router.refresh();
  }

  async function saveOptions(groups: OptionGroup[]) {
    const r = await fetch(`/api/admin/menu-items/${current.id}/options`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groups: groups.map((g) => ({
          name: g.name,
          required: g.required,
          multiple: g.multiple,
          choices: g.choices.map((c) => ({
            label: c.label,
            priceDelta: c.priceDelta,
          })),
        })),
      }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      dialog.toast({ message: `Lỗi lưu tuỳ chọn: ${d.error ?? r.status}`, type: "error" });
      return;
    }
    dialog.toast({ message: "Đã lưu tuỳ chọn", type: "success" });
    setOptionsDirty(false);
    setCurrent((prev) => ({ ...prev, optionGroups: groups }));
    router.refresh();
  }

  async function remove() {
    const ok = await dialog.confirm({
      icon: "🗑️",
      title: `Xoá "${current.name}"?`,
      message: "Đơn hàng cũ giữ nguyên. Món bị ẩn khỏi menu.",
      confirmLabel: "Xoá món",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/menu-items/${current.id}`, { method: "DELETE" });
    dialog.toast({ message: "Đã xoá", type: "success" });
    router.push(`/admin/${restaurantId}/menu`);
  }

  return (
    <div className="p-6 md:p-10">
      <nav className="mb-4 text-sm text-ink-500">
        <Link href={`/admin/${restaurantId}/menu`} className="hover:text-brand-600">
          ← Thực đơn
        </Link>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 flex-none overflow-hidden rounded-2xl bg-ink-100">
            {current.image ? (
              <SafeImg src={current.image} alt={current.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
            )}
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-ink-950">
              {current.name || "Món mới"}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-ink-500">
              <span className="font-semibold text-brand-700">{formatVND(current.price)}</span>
              {current.stationId && (
                <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold">
                  {stations.find((s) => s.id === current.stationId)?.name ?? "Station"}
                </span>
              )}
              {!current.isAvailable && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                  Tạm hết
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => patchInfo("isAvailable", !current.isAvailable)}
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            {current.isAvailable ? "Tạm hết hàng" : "Bán lại"}
          </button>
          <button
            onClick={remove}
            className="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Xoá món
          </button>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-1 border-b border-ink-100">
        <TabBtn active={tab === "info"} onClick={() => setTab("info")} dirty={infoDirty}>
          Thông tin
        </TabBtn>
        <TabBtn active={tab === "options"} onClick={() => setTab("options")} dirty={optionsDirty}>
          Tuỳ chọn riêng
          <span className="ml-1 rounded-full bg-ink-100 px-1.5 text-[10px] font-semibold text-ink-600">
            {current.optionGroups.length}
          </span>
        </TabBtn>
        <TabBtn
          active={tab === "templates"}
          onClick={() => setTab("templates")}
          dirty={templatesDirty}
        >
          Nhóm dùng chung
          <span className="ml-1 rounded-full bg-ink-100 px-1.5 text-[10px] font-semibold text-ink-600">
            {attachedIds.length}
          </span>
        </TabBtn>
        <div className="ml-auto flex items-center px-2 text-xs text-ink-400">
          Biến thể & Combo — sắp ra mắt
        </div>
      </div>

      {tab === "info" && (
        <InfoTab
          current={current}
          categories={categories}
          stations={stations}
          dirty={infoDirty}
          onPatch={patchInfo}
          onSave={saveInfo}
        />
      )}
      {tab === "options" && (
        <OptionsTab
          initial={current.optionGroups}
          onSave={saveOptions}
          onDirty={setOptionsDirty}
          dirty={optionsDirty}
        />
      )}
      {tab === "templates" && (
        <TemplatesTab
          restaurantId={restaurantId}
          allTemplates={allTemplates}
          attachedIds={attachedIds}
          onToggle={toggleAttach}
          onSave={saveTemplates}
          dirty={templatesDirty}
        />
      )}
    </div>
  );
}

function TemplatesTab({
  restaurantId,
  allTemplates,
  attachedIds,
  onToggle,
  onSave,
  dirty,
}: {
  restaurantId: string;
  allTemplates: TemplatePreview[];
  attachedIds: string[];
  onToggle: (id: string) => void;
  onSave: () => void;
  dirty: boolean;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Nhóm tuỳ chọn dùng chung</div>
          <p className="mt-1 text-sm text-ink-500">
            Áp các nhóm định nghĩa sẵn (VD: Size S/M/L, Độ ngọt, Topping) thay vì
            gõ lại trên từng món. Sửa thư viện → tất cả món đang áp tự cập nhật.
          </p>
        </div>
        <a
          href={`/admin/${restaurantId}/menu/modifiers`}
          className="whitespace-nowrap rounded-full border border-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-50"
        >
          Mở thư viện
        </a>
      </div>

      {allTemplates.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-ink-200 p-8 text-center text-sm text-ink-500">
          Chưa có nhóm nào trong thư viện.{" "}
          <a
            href={`/admin/${restaurantId}/menu/modifiers`}
            className="font-semibold text-brand-600 hover:underline"
          >
            Tạo nhóm đầu tiên →
          </a>
        </div>
      )}

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {allTemplates.map((t) => {
          const on = attachedIds.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => onToggle(t.id)}
              className={`rounded-2xl border p-3 text-left transition ${
                on
                  ? "border-brand-500 bg-brand-50"
                  : "border-ink-100 bg-white hover:border-brand-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{t.name}</div>
                  <div className="mt-0.5 flex gap-1">
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
                  </div>
                </div>
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
                    on ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-400"
                  }`}
                >
                  {on ? "✓" : "+"}
                </span>
              </div>
              <div className="mt-2 text-xs text-ink-600">
                {t.choices
                  .slice(0, 3)
                  .map((c) => `${c.label}${c.priceDelta ? ` (+${c.priceDelta.toLocaleString("vi-VN")})` : ""}`)
                  .join(" · ")}
                {t.choices.length > 3 && ` +${t.choices.length - 3}`}
              </div>
            </button>
          );
        })}
      </div>

      {dirty && (
        <button
          onClick={onSave}
          className="mt-6 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Lưu nhóm áp dụng
        </button>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
  dirty,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  dirty?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-b-2 border-brand-600 text-brand-700"
          : "text-ink-600 hover:text-ink-900"
      }`}
    >
      {children}
      {dirty && (
        <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
      )}
    </button>
  );
}

function InfoTab({
  current,
  categories,
  stations,
  dirty,
  onPatch,
  onSave,
}: {
  current: Item;
  categories: Array<{ id: string; name: string }>;
  stations: Array<{ id: string; name: string }>;
  dirty: boolean;
  onPatch: <K extends keyof Item>(k: K, v: Item[K]) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Field label="Tên món">
          <input
            value={current.name}
            onChange={(e) => onPatch("name", e.target.value)}
            className="w-full rounded-xl border border-ink-200 px-3 py-2"
          />
        </Field>
        <Field label="Mô tả ngắn">
          <textarea
            rows={3}
            value={current.description ?? ""}
            onChange={(e) => onPatch("description", e.target.value || null)}
            className="w-full rounded-xl border border-ink-200 px-3 py-2"
          />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Giá (VND)">
            <input
              type="number"
              value={current.price}
              onChange={(e) => onPatch("price", parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
            />
          </Field>
          <Field label="Danh mục">
            <Select
              value={current.categoryId}
              onChange={(v) => onPatch("categoryId", v)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
        </div>
        <Field label="URL ảnh">
          <input
            value={current.image ?? ""}
            onChange={(e) => onPatch("image", e.target.value || null)}
            placeholder="https://..."
            className="w-full rounded-xl border border-ink-200 px-3 py-2 font-mono text-xs"
          />
          <p className="mt-1 text-xs text-ink-500">
            Upload ảnh trực tiếp — sắp ra mắt. Tạm thời paste URL Unsplash/Cloudinary.
          </p>
        </Field>
        <Field label="In tại station">
          <Select
            value={current.stationId ?? ""}
            onChange={(v) => onPatch("stationId", v || null)}
            options={[
              { value: "", label: "— không in bếp —" },
              ...stations.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
        </Field>
      </div>

      <div className="lg:col-span-1">
        <div className="rounded-2xl border border-ink-100 bg-white p-4">
          <div className="font-semibold">Xem trước</div>
          <div className="mt-3 rounded-xl border border-ink-100 p-3">
            <div className="h-32 w-full overflow-hidden rounded-lg bg-ink-100">
              {current.image ? (
                <SafeImg src={current.image} alt={current.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-3xl">🍽️</div>
              )}
            </div>
            <div className="mt-2 font-semibold">{current.name || "Tên món"}</div>
            <div className="text-xs text-ink-500">
              {current.description || "Chưa có mô tả"}
            </div>
            <div className="mt-1 text-sm font-semibold text-brand-700">
              {formatVND(current.price)}
            </div>
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={!dirty}
          className="mt-4 w-full rounded-full bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          {dirty ? "Lưu thay đổi" : "Chưa có thay đổi"}
        </button>
      </div>
    </div>
  );
}

function OptionsTab({
  initial,
  onSave,
  onDirty,
  dirty,
}: {
  initial: OptionGroup[];
  onSave: (groups: OptionGroup[]) => void;
  onDirty: (d: boolean) => void;
  dirty: boolean;
}) {
  const [groups, setGroups] = useState<OptionGroup[]>(initial);

  function markDirty(next: OptionGroup[]) {
    setGroups(next);
    onDirty(true);
  }

  function addGroup() {
    markDirty([
      ...groups,
      { name: "Size", required: false, multiple: false, choices: [{ label: "S", priceDelta: 0 }] },
    ]);
  }
  function removeGroup(idx: number) {
    markDirty(groups.filter((_, i) => i !== idx));
  }
  function updateGroup(idx: number, patch: Partial<OptionGroup>) {
    markDirty(groups.map((g, i) => (i === idx ? { ...g, ...patch } : g)));
  }
  function addChoice(gIdx: number) {
    markDirty(
      groups.map((g, i) =>
        i === gIdx ? { ...g, choices: [...g.choices, { label: "", priceDelta: 0 }] } : g,
      ),
    );
  }
  function removeChoice(gIdx: number, cIdx: number) {
    markDirty(
      groups.map((g, i) =>
        i === gIdx ? { ...g, choices: g.choices.filter((_, j) => j !== cIdx) } : g,
      ),
    );
  }
  function updateChoice(gIdx: number, cIdx: number, patch: Partial<OptionChoice>) {
    markDirty(
      groups.map((g, i) =>
        i === gIdx
          ? {
              ...g,
              choices: g.choices.map((c, j) => (j === cIdx ? { ...c, ...patch } : c)),
            }
          : g,
      ),
    );
  }

  return (
    <div className="mt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold">Nhóm tuỳ chọn</div>
          <p className="mt-1 text-sm text-ink-500">
            Ví dụ: <strong>Size</strong> (chọn 1, bắt buộc), <strong>Topping</strong> (chọn nhiều,
            không bắt buộc), <strong>Độ cay</strong> (chọn 1). Khách chọn khi thêm vào giỏ — giá
            cộng thêm sẽ tự vào tổng.
          </p>
        </div>
        <button
          onClick={addGroup}
          className="whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Thêm nhóm
        </button>
      </div>

      {groups.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-ink-200 p-10 text-center text-ink-500">
          Chưa có nhóm tuỳ chọn. Nếu món này có size hoặc topping — bấm "+ Thêm nhóm".
        </div>
      )}

      <div className="mt-4 space-y-4">
        {groups.map((g, gi) => (
          <div key={gi} className="rounded-2xl border border-ink-100 bg-white p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={g.name}
                onChange={(e) => updateGroup(gi, { name: e.target.value })}
                placeholder="Tên nhóm (Size, Topping, Độ cay...)"
                className="flex-1 rounded-xl border border-ink-200 px-3 py-2 font-semibold"
              />
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={g.required}
                  onChange={(e) => updateGroup(gi, { required: e.target.checked })}
                />
                <span>Bắt buộc</span>
              </label>
              <label className="inline-flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={g.multiple}
                  onChange={(e) => updateGroup(gi, { multiple: e.target.checked })}
                />
                <span>Chọn nhiều</span>
              </label>
              <button
                onClick={() => removeGroup(gi)}
                className="text-xs font-semibold text-red-600 hover:text-red-700"
              >
                Xoá nhóm
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {g.choices.map((c, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <input
                    value={c.label}
                    onChange={(e) => updateChoice(gi, ci, { label: e.target.value })}
                    placeholder="Nhãn (VD: Size L, Trân châu, Ít đá)"
                    className="flex-1 rounded-lg border border-ink-200 px-3 py-1.5 text-sm"
                  />
                  <div className="flex items-center gap-1 text-xs text-ink-500">+VND</div>
                  <input
                    type="number"
                    value={c.priceDelta}
                    onChange={(e) =>
                      updateChoice(gi, ci, { priceDelta: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-24 rounded-lg border border-ink-200 px-2 py-1.5 font-mono text-sm"
                  />
                  <button
                    onClick={() => removeChoice(gi, ci)}
                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    Xoá
                  </button>
                </div>
              ))}
              <button
                onClick={() => addChoice(gi)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                + Thêm lựa chọn
              </button>
            </div>
          </div>
        ))}
      </div>

      {groups.length > 0 && (
        <button
          onClick={() => onSave(groups)}
          disabled={!dirty}
          className="mt-6 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-300"
        >
          {dirty ? "Lưu tuỳ chọn" : "Chưa có thay đổi"}
        </button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </div>
      {children}
    </label>
  );
}
