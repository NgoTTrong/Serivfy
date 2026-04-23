"use client";

import { useEffect, useState } from "react";
import { formatVND } from "@/lib/format";
import { SafeImg } from "@/components/SafeImg";
import { useDialog } from "@/components/DialogProvider";
import { Select } from "@/components/Select";

type Category = { id: string; name: string; order: number };
type Item = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  isAvailable: boolean;
  categoryId: string;
  category: Category;
  order: number;
};

export default function MenuManager() {
  const dialog = useDialog();
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const [a, b] = await Promise.all([
      fetch("/api/admin/categories").then((r) => r.json()),
      fetch("/api/admin/menu-items").then((r) => r.json()),
    ]);
    setCats(a.categories || []);
    setItems(b.items || []);
    setLoaded(true);
  }
  useEffect(() => {
    load();
  }, []);

  async function toggleAvail(item: Item) {
    await fetch(`/api/admin/menu-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAvailable: !item.isAvailable }),
    });
    load();
  }
  async function deleteItem(item: Item) {
    const ok = await dialog.confirm({
      icon: "🗑️",
      title: `Xoá "${item.name}"?`,
      message: "Hành động này không thể khôi phục. Đơn hàng cũ vẫn giữ nguyên giá.",
      confirmLabel: "Xoá món",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/menu-items/${item.id}`, { method: "DELETE" });
    dialog.toast({ message: `Đã xoá ${item.name}`, type: "success" });
    load();
  }
  async function deleteCat(c: Category) {
    const ok = await dialog.confirm({
      icon: "🗑️",
      title: `Xoá danh mục "${c.name}"?`,
      message: "Chỉ xoá được khi danh mục không còn món nào.",
      confirmLabel: "Xoá danh mục",
      danger: true,
    });
    if (!ok) return;
    const r = await fetch(`/api/admin/categories/${c.id}`, { method: "DELETE" });
    if (!r.ok) {
      await dialog.alert({
        icon: "⚠️",
        title: "Không xoá được",
        message: "Danh mục này vẫn còn món. Hãy chuyển hoặc xoá các món trước.",
        tone: "danger",
      });
    } else {
      dialog.toast({ message: "Đã xoá danh mục", type: "success" });
    }
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">Thực đơn</h1>
          <p className="text-sm text-ink-500">Quản lý danh mục & món ăn</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAddingCat(true)}
            className="whitespace-nowrap rounded-full border border-ink-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-ink-50"
          >
            + Danh mục
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="whitespace-nowrap rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + Thêm món
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="mt-6 flex flex-wrap gap-2">
        {!loaded
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-8 w-24 rounded-full bg-ink-100 shimmer"
              />
            ))
          : cats.map((c) => (
              <div
                key={c.id}
                className="group inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 shadow-sm ring-1 ring-ink-100"
              >
                <span className="font-medium">{c.name}</span>
                <button
                  onClick={() => deleteCat(c)}
                  className="text-xs text-ink-400 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
      </div>

      {/* Skeleton items grid while loading */}
      {!loaded && (
        <div className="mt-8 space-y-8">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i}>
              <div className="mb-3 h-6 w-40 rounded bg-ink-100 shimmer" />
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div
                    key={j}
                    className="flex gap-3 rounded-2xl border border-ink-100 bg-white p-3"
                  >
                    <div className="h-20 w-20 flex-none rounded-xl bg-ink-100 shimmer" />
                    <div className="flex flex-1 flex-col justify-between py-1">
                      <div className="space-y-2">
                        <div className="h-4 w-3/4 rounded bg-ink-100 shimmer" />
                        <div className="h-3 w-1/2 rounded bg-ink-100 shimmer" />
                      </div>
                      <div className="h-4 w-20 rounded bg-ink-100 shimmer" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Items grouped by cat */}
      <div className="mt-8 space-y-8">
        {cats.map((cat) => {
          const catItems = items.filter((i) => i.categoryId === cat.id);
          return (
            <div key={cat.id}>
              <h2 className="mb-3 font-display text-xl font-bold text-ink-900">{cat.name}</h2>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {catItems.map((it) => (
                  <div
                    key={it.id}
                    className={`group flex gap-3 rounded-2xl border bg-white p-3 transition hover:shadow-md ${
                      it.isAvailable
                        ? "border-ink-100 hover:border-brand-200"
                        : "border-red-200 bg-red-50/30"
                    }`}
                  >
                    <div className="relative h-20 w-20 flex-none overflow-hidden rounded-xl">
                      <SafeImg
                        src={it.image}
                        alt={it.name}
                        className="h-full w-full object-cover"
                      />
                      {!it.isAvailable && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-bold text-white">
                          HẾT
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{it.name}</div>
                          {it.description && (
                            <div className="line-clamp-1 text-xs text-ink-500">
                              {it.description}
                            </div>
                          )}
                        </div>
                        <div className="whitespace-nowrap font-bold text-brand-700">
                          {formatVND(it.price)}
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <button
                          onClick={() => toggleAvail(it)}
                          title={it.isAvailable ? "Bấm để tắt — đánh dấu hết món" : "Bấm để bật — đánh dấu đang bán"}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                            it.isAvailable
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-red-100 text-red-700 hover:bg-red-200"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              it.isAvailable ? "bg-green-500" : "bg-red-500"
                            }`}
                          />
                          {it.isAvailable ? "Đang bán" : "Hết món"}
                        </button>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditing(it)}
                            title="Sửa"
                            aria-label="Sửa"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-900"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => deleteItem(it)}
                            title="Xoá"
                            aria-label="Xoá"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-red-50 hover:text-red-600"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {addingCat && (
        <CategoryDialog
          onClose={() => setAddingCat(false)}
          onSaved={() => {
            setAddingCat(false);
            load();
          }}
        />
      )}
      {(showNew || editing) && (
        <ItemDialog
          item={editing || undefined}
          categories={cats}
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

function CategoryDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  async function save() {
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    onSaved();
  }
  return (
    <Dialog onClose={onClose} title="Danh mục mới">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-xl border border-ink-200 px-4 py-3"
        placeholder="Tên danh mục"
        autoFocus
      />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2 text-ink-600">
          Hủy
        </button>
        <button onClick={save} className="rounded-xl bg-brand-600 px-4 py-2 text-white">
          Lưu
        </button>
      </div>
    </Dialog>
  );
}

function ItemDialog({
  item,
  categories,
  onClose,
  onSaved,
}: {
  item?: Item;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item?.name || "");
  const [desc, setDesc] = useState(item?.description || "");
  const [price, setPrice] = useState(String(item?.price || ""));
  const [catId, setCatId] = useState(item?.categoryId || categories[0]?.id || "");
  const [image, setImage] = useState(item?.image || "");
  async function save() {
    const body = {
      name,
      description: desc || null,
      price: Number(price),
      categoryId: catId,
      image: image || null,
    };
    if (item) {
      await fetch(`/api/admin/menu-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/admin/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    onSaved();
  }
  return (
    <Dialog onClose={onClose} title={item ? "Sửa món" : "Thêm món mới"}>
      <div className="space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tên món"
          className="w-full rounded-xl border border-ink-200 px-4 py-3"
        />
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="Mô tả (tuỳ chọn)"
          className="w-full rounded-xl border border-ink-200 px-4 py-3"
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Giá (VND)"
            className="rounded-xl border border-ink-200 px-4 py-3 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <Select
            value={catId}
            onChange={setCatId}
            placeholder="Chọn danh mục"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </div>
        <input
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="URL ảnh (tuỳ chọn)"
          className="w-full rounded-xl border border-ink-200 px-4 py-3"
        />
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2 text-ink-600">
          Hủy
        </button>
        <button onClick={save} className="rounded-xl bg-brand-600 px-4 py-2 text-white">
          Lưu
        </button>
      </div>
    </Dialog>
  );
}

function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">{title}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
