"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useDialog } from "@/components/DialogProvider";
import { formatVND } from "@/lib/format";

type MenuItemOpt = {
  id: string;
  name: string;
  price: number;
  image: string | null;
  categoryName: string;
};

type ComboItem = {
  menuItemId: string;
  menuItem: { id: string; name: string; price: number };
  quantity: number;
  note: string | null;
};

type Combo = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  isAvailable: boolean;
  items: ComboItem[];
};

type Draft = {
  id?: string;
  name: string;
  description: string;
  price: number;
  image: string;
  isAvailable: boolean;
  items: Array<{ menuItemId: string; quantity: number; note: string }>;
};

export default function CombosClient({
  restaurantId,
  allItems,
}: {
  restaurantId: string;
  allItems: MenuItemOpt[];
}) {
  const dialog = useDialog();
  const [combos, setCombos] = useState<Combo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/combos");
    if (r.ok) setCombos((await r.json()).combos || []);
    setLoaded(true);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(d: Draft) {
    if (!d.name.trim() || d.items.length === 0) {
      dialog.toast({ message: "Nhập tên + chọn ít nhất 1 món", type: "error" });
      return;
    }
    const body = {
      name: d.name.trim(),
      description: d.description || null,
      price: d.price,
      image: d.image || null,
      isAvailable: d.isAvailable,
      items: d.items.map((i) => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        note: i.note || null,
      })),
    };
    const r = d.id
      ? await fetch(`/api/admin/combos/${d.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/admin/combos", {
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

  async function remove(c: Combo) {
    const ok = await dialog.confirm({
      icon: "🗑️",
      title: `Xoá "${c.name}"?`,
      message: "Combo sẽ bị ẩn khỏi menu. Đơn cũ giữ nguyên.",
      confirmLabel: "Xoá",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/combos/${c.id}`, { method: "DELETE" });
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

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">Combo</h1>
          <p className="text-sm text-ink-500">
            Gói combo nhiều món — bán với giá ưu đãi so với lẻ.
          </p>
        </div>
        <button
          onClick={() =>
            setEditing({
              name: "",
              description: "",
              price: 0,
              image: "",
              isAvailable: true,
              items: [],
            })
          }
          className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          + Tạo combo
        </button>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {!loaded &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-48 rounded-2xl border border-ink-100 bg-white shimmer" />
          ))}
        {loaded && combos.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-ink-200 p-10 text-center text-ink-500">
            Chưa có combo. Ví dụ: “Combo gia đình” = 1 Phở + 1 Bún chả + 3 Trà đá = 250k.
          </div>
        )}
        {combos.map((c) => {
          const sumAlone = c.items.reduce(
            (s, it) => s + it.menuItem.price * it.quantity,
            0,
          );
          const saving = sumAlone - c.price;
          return (
            <div
              key={c.id}
              className={`rounded-2xl border bg-white p-4 ${
                c.isAvailable ? "border-ink-100" : "border-ink-200 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-display text-lg font-bold">{c.name}</div>
                  {c.description && (
                    <div className="text-xs text-ink-500">{c.description}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-brand-700">{formatVND(c.price)}</div>
                  {saving > 0 && (
                    <div className="text-[10px] font-semibold text-emerald-600">
                      Tiết kiệm {formatVND(saving)}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1">
                {c.items.map((it) => (
                  <div key={it.menuItemId} className="flex justify-between text-xs text-ink-600">
                    <span>
                      {it.quantity}× {it.menuItem.name}
                    </span>
                    <span className="font-mono text-ink-400">
                      {formatVND(it.menuItem.price * it.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() =>
                    setEditing({
                      id: c.id,
                      name: c.name,
                      description: c.description ?? "",
                      price: c.price,
                      image: c.image ?? "",
                      isAvailable: c.isAvailable,
                      items: c.items.map((i) => ({
                        menuItemId: i.menuItemId,
                        quantity: i.quantity,
                        note: i.note ?? "",
                      })),
                    })
                  }
                  className="rounded-full border border-ink-200 px-3 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                >
                  Sửa
                </button>
                <button
                  onClick={() => remove(c)}
                  className="ml-auto text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Xoá
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <EditDialog
          draft={editing}
          allItems={allItems}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </div>
  );
}

function EditDialog({
  draft,
  allItems,
  onClose,
  onSave,
}: {
  draft: Draft;
  allItems: MenuItemOpt[];
  onClose: () => void;
  onSave: (d: Draft) => void;
}) {
  const [d, setD] = useState<Draft>(draft);
  const [search, setSearch] = useState("");

  const sumAlone = d.items.reduce((s, it) => {
    const m = allItems.find((x) => x.id === it.menuItemId);
    return s + (m?.price ?? 0) * it.quantity;
  }, 0);
  const saving = sumAlone - d.price;

  function setItemQty(id: string, qty: number) {
    if (qty <= 0) {
      setD({ ...d, items: d.items.filter((i) => i.menuItemId !== id) });
      return;
    }
    const existing = d.items.find((i) => i.menuItemId === id);
    if (existing) {
      setD({
        ...d,
        items: d.items.map((i) => (i.menuItemId === id ? { ...i, quantity: qty } : i)),
      });
    } else {
      setD({ ...d, items: [...d.items, { menuItemId: id, quantity: qty, note: "" }] });
    }
  }

  const filteredItems = allItems.filter((it) =>
    it.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="grid max-h-[95vh] w-full max-w-4xl grid-cols-1 gap-0 overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-2">
        <div className="flex flex-col overflow-y-auto border-r border-ink-100 p-5">
          <div className="font-display text-xl font-bold">
            {draft.id ? "Sửa combo" : "Tạo combo"}
          </div>
          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="font-semibold">Tên combo</span>
              <input
                value={d.name}
                onChange={(e) => setD({ ...d, name: e.target.value })}
                placeholder="Combo gia đình"
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Mô tả</span>
              <textarea
                rows={2}
                value={d.description}
                onChange={(e) => setD({ ...d, description: e.target.value })}
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Giá combo (VND)</span>
              <input
                type="number"
                value={d.price}
                onChange={(e) => setD({ ...d, price: parseInt(e.target.value, 10) || 0 })}
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Ảnh (URL)</span>
              <input
                value={d.image}
                onChange={(e) => setD({ ...d, image: e.target.value })}
                placeholder="https://..."
                className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono text-xs"
              />
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.isAvailable}
                onChange={(e) => setD({ ...d, isAvailable: e.target.checked })}
              />
              <span>Đang bán</span>
            </label>
          </div>

          <div className="mt-5 rounded-xl border border-ink-100 bg-ink-50 p-3 text-sm">
            <div className="flex justify-between">
              <span>Mua lẻ:</span>
              <span className="font-mono">{formatVND(sumAlone)}</span>
            </div>
            <div className="flex justify-between">
              <span>Giá combo:</span>
              <span className="font-mono">{formatVND(d.price)}</span>
            </div>
            <div
              className={`mt-1 flex justify-between font-semibold ${
                saving > 0 ? "text-emerald-600" : "text-red-600"
              }`}
            >
              <span>{saving > 0 ? "Khách tiết kiệm:" : "Combo đắt hơn lẻ:"}</span>
              <span>{formatVND(Math.abs(saving))}</span>
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
              disabled={!d.name.trim() || d.items.length === 0}
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-ink-300"
            >
              Lưu
            </button>
          </div>
        </div>

        <div className="flex flex-col overflow-hidden bg-ink-50">
          <div className="border-b border-ink-100 bg-white p-4">
            <div className="font-semibold">Chọn món vào combo ({d.items.length})</div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm món..."
              className="mt-2 w-full rounded-xl border border-ink-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {filteredItems.map((it) => {
                const picked = d.items.find((x) => x.menuItemId === it.id);
                return (
                  <div
                    key={it.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition ${
                      picked ? "border-brand-500 bg-brand-50" : "border-ink-100 bg-white"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{it.name}</div>
                      <div className="text-xs text-ink-500">
                        {it.categoryName} · {formatVND(it.price)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setItemQty(it.id, (picked?.quantity ?? 0) - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 text-sm"
                      >
                        −
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">
                        {picked?.quantity ?? 0}
                      </span>
                      <button
                        onClick={() => setItemQty(it.id, (picked?.quantity ?? 0) + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
