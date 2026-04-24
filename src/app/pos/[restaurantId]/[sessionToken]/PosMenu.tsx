"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/DialogProvider";
import { CashierDrawer } from "@/components/CashierDrawer";
import { useRealtime } from "@/lib/use-realtime";
import { formatVND } from "@/lib/format";
import { SafeImg } from "@/components/SafeImg";

type OptionChoice = { id: string; label: string; priceDelta: number };
type OptionGroup = {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  choices: OptionChoice[];
};
type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  isAvailable: boolean;
  optionGroups: OptionGroup[];
};
type Category = { id: string; name: string; menuItems: MenuItem[] };
type CartItem = {
  id: string;
  menuItemId: string;
  quantity: number;
  note: string | null;
  optionsLabel: string | null;
  optionsPrice: number;
  menuItem: { id: string; name: string; price: number; image: string | null };
};

/**
 * POS menu screen for staff ordering on behalf of a table.
 *
 * Reuses the same customer `/api/session/[token]/*` endpoints so cart +
 * rounds + bill behavior stays identical — staff are just a special
 * "guest" on the session. Delta vs the customer UI: dense grid layout
 * optimised for a counter keyboard + touchscreen, an inline "Thanh toán"
 * button that opens the existing CashierDrawer, and a persistent cart
 * panel instead of a bottom drawer.
 */
export default function PosMenu({
  restaurantId,
  sessionToken,
  sessionId,
  tableId,
  tableLabel,
  guestId,
  staffName,
}: {
  restaurantId: string;
  sessionToken: string;
  sessionId: string;
  tableId: string;
  tableLabel: string;
  guestId: string;
  staffName: string;
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [cats, setCats] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [optionModalItem, setOptionModalItem] = useState<MenuItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cashier, setCashier] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [menuLoaded, setMenuLoaded] = useState(false);

  const pulse = useRealtime({
    restaurantId,
    scope: "customer",
    sessionToken,
    fallbackIntervalMs: 3000,
  });

  // Menu — rarely changes mid-service, but refresh on a menu pulse event
  // in case admin edits while POS is open.
  const menuPulse = useRealtime({
    restaurantId,
    scope: "menu",
    fallbackIntervalMs: 30_000,
  });
  useEffect(() => {
    let alive = true;
    fetch(`/api/session/${sessionToken}/menu`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setCats(d.categories || []);
        if (!activeCat && d.categories?.[0]) setActiveCat(d.categories[0].id);
        setMenuLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [sessionToken, menuPulse, activeCat]);

  // Cart + pending count
  useEffect(() => {
    let alive = true;
    async function load() {
      const [cartR, ordersR] = await Promise.all([
        fetch(`/api/session/${sessionToken}/cart`),
        fetch(`/api/session/${sessionToken}/orders`),
      ]);
      if (!alive) return;
      if (cartR.ok) {
        const d = await cartR.json();
        setCart(d.items || []);
      }
      if (ordersR.ok) {
        const d = await ordersR.json();
        const rounds = d.rounds || [];
        let pending = 0;
        for (const r of rounds) {
          for (const it of r.items) {
            if (it.servedQty < it.quantity) pending += it.quantity - it.servedQty;
          }
        }
        setPendingCount(pending);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [sessionToken, pulse]);

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (s, c) => s + (c.menuItem.price + c.optionsPrice) * c.quantity,
        0,
      ),
    [cart],
  );

  async function addItem(item: MenuItem, choiceIds: string[] = []) {
    const res = await fetch(`/api/session/${sessionToken}/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestId,
        menuItemId: item.id,
        quantity: 1,
        choiceIds,
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      dialog.toast({
        message: `Không thêm được: ${d.error ?? res.status}`,
        type: "error",
      });
      return;
    }
    // Optimistic refresh via pulse; immediate fetch keeps UI snappy
    const r = await fetch(`/api/session/${sessionToken}/cart`);
    if (r.ok) setCart((await r.json()).items || []);
  }

  function clickItem(item: MenuItem) {
    if (!item.isAvailable) {
      dialog.toast({ message: "Món hết", type: "error" });
      return;
    }
    if (item.optionGroups.length > 0) {
      setOptionModalItem(item);
    } else {
      addItem(item);
    }
  }

  async function patchCart(itemId: string, quantity: number) {
    await fetch(`/api/session/${sessionToken}/cart/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    const r = await fetch(`/api/session/${sessionToken}/cart`);
    if (r.ok) setCart((await r.json()).items || []);
  }

  async function submitRound() {
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    try {
      const r = await fetch(`/api/session/${sessionToken}/order`, { method: "POST" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        dialog.toast({ message: `Lỗi: ${d.error ?? r.status}`, type: "error" });
        return;
      }
      const d = await r.json();
      dialog.toast({
        message: `Đã gửi bếp — Lượt ${d.roundNumber}`,
        type: "success",
      });
      setCart([]);
    } finally {
      setSubmitting(false);
    }
  }

  const activeCategory = cats.find((c) => c.id === activeCat);

  return (
    <div className="flex min-h-screen flex-col bg-ink-50 lg:flex-row">
      {/* Sidebar / header */}
      <aside className="border-b border-ink-100 bg-white p-4 lg:w-56 lg:border-b-0 lg:border-r">
        <Link
          href={`/pos/${restaurantId}`}
          className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-700"
        >
          ← Danh sách bàn
        </Link>
        <div className="mt-3 text-[10px] uppercase tracking-widest text-brand-600">POS</div>
        <div className="font-display text-2xl font-bold">{tableLabel}</div>
        <div className="mt-1 text-xs text-ink-500">{staffName}</div>

        <nav className="mt-4 flex flex-wrap gap-2 lg:flex-col">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`rounded-xl px-3 py-2 text-left text-sm transition ${
                activeCat === c.id
                  ? "bg-brand-600 text-white"
                  : "bg-ink-100 text-ink-700 hover:bg-ink-200"
              }`}
            >
              {c.name}{" "}
              <span className="text-xs opacity-70">({c.menuItems.length})</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Menu grid */}
      <main className="flex-1 p-4 md:p-6">
        {!menuLoaded && (
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl border border-ink-100 bg-white shimmer" />
            ))}
          </div>
        )}
        {menuLoaded && activeCategory && (
          <div>
            <h2 className="font-display text-xl font-bold">{activeCategory.name}</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activeCategory.menuItems.map((m) => (
                <button
                  key={m.id}
                  onClick={() => clickItem(m)}
                  className={`flex items-center gap-3 rounded-2xl border bg-white p-3 text-left transition hover:shadow-md ${
                    m.isAvailable ? "border-ink-100" : "border-ink-200 opacity-50"
                  }`}
                >
                  <div className="h-14 w-14 flex-none overflow-hidden rounded-xl bg-ink-100">
                    {m.image ? (
                      <SafeImg src={m.image} alt={m.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl">
                        🍽️
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{m.name}</div>
                    <div className="text-sm font-semibold text-brand-700">
                      {formatVND(m.price)}
                      {m.optionGroups.length > 0 && (
                        <span className="ml-1 text-xs text-ink-500">+ options</span>
                      )}
                    </div>
                  </div>
                  {!m.isAvailable && (
                    <span className="text-xs font-semibold text-red-600">Hết</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Cart panel */}
      <aside className="border-t border-ink-100 bg-white p-4 lg:w-80 lg:border-l lg:border-t-0">
        <div className="font-display text-lg font-bold">Giỏ hiện tại</div>
        {pendingCount > 0 && (
          <div className="mt-1 text-xs text-amber-700">
            Bàn còn {pendingCount} món chưa phục vụ
          </div>
        )}
        <div className="mt-3 max-h-[40vh] space-y-2 overflow-y-auto">
          {cart.length === 0 && (
            <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
              Click món bên trái để thêm.
            </div>
          )}
          {cart.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-2 rounded-xl border border-ink-100 p-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{c.menuItem.name}</div>
                {c.optionsLabel && (
                  <div className="truncate text-xs text-ink-500">{c.optionsLabel}</div>
                )}
                <div className="text-xs text-brand-700">
                  {formatVND((c.menuItem.price + c.optionsPrice) * c.quantity)}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => patchCart(c.id, Math.max(0, c.quantity - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-sm"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold">{c.quantity}</span>
                <button
                  onClick={() => patchCart(c.id, c.quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-ink-100 text-sm"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
          <div className="flex justify-between text-sm">
            <span>Tạm tính giỏ:</span>
            <span className="font-semibold">{formatVND(cartTotal)}</span>
          </div>
          <button
            onClick={submitRound}
            disabled={cart.length === 0 || submitting}
            className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-300"
          >
            {submitting ? "Đang gửi..." : "Gửi bếp"}
          </button>
          <button
            onClick={() => setCashier(true)}
            className="w-full rounded-xl border border-ink-200 py-3 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Thanh toán & đóng bàn
          </button>
        </div>
      </aside>

      {optionModalItem && (
        <OptionPickerModal
          item={optionModalItem}
          onClose={() => setOptionModalItem(null)}
          onConfirm={(ids) => {
            addItem(optionModalItem, ids);
            setOptionModalItem(null);
          }}
        />
      )}

      {cashier && (
        <CashierDrawer
          sessionToken={sessionToken}
          tableId={tableId}
          tableLabel={tableLabel}
          pendingCount={pendingCount}
          onClose={() => setCashier(false)}
          onClosed={() => {
            setCashier(false);
            router.push(`/pos/${restaurantId}`);
          }}
        />
      )}

      {/* Keep the sessionId variable live for future receipt-reprint hooks */}
      <span data-session-id={sessionId} className="hidden" />
    </div>
  );
}

function OptionPickerModal({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItem;
  onClose: () => void;
  onConfirm: (choiceIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Record<string, string[]>>({});

  function toggle(groupId: string, choiceId: string, multiple: boolean) {
    setSelected((prev) => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(choiceId)) {
        return { ...prev, [groupId]: cur.filter((id) => id !== choiceId) };
      }
      if (multiple) return { ...prev, [groupId]: [...cur, choiceId] };
      return { ...prev, [groupId]: [choiceId] };
    });
  }

  const missingRequired = item.optionGroups.some(
    (g) => g.required && (selected[g.id]?.length ?? 0) === 0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="font-display text-lg font-bold">{item.name}</div>
        <div className="mt-4 max-h-[60vh] space-y-4 overflow-y-auto">
          {item.optionGroups.map((g) => (
            <div key={g.id}>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>
                  {g.name}
                  {g.required && <span className="ml-1 text-red-600">*</span>}
                </span>
                {g.multiple && <span className="text-xs text-ink-500">chọn nhiều</span>}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {g.choices.map((c) => {
                  const on = selected[g.id]?.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => toggle(g.id, c.id, g.multiple)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm ${
                        on
                          ? "border-brand-500 bg-brand-50 text-brand-700"
                          : "border-ink-200 hover:bg-ink-50"
                      }`}
                    >
                      <div>{c.label}</div>
                      {c.priceDelta !== 0 && (
                        <div className="text-xs text-ink-500">
                          {c.priceDelta > 0 ? "+" : ""}
                          {formatVND(c.priceDelta)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Huỷ
          </button>
          <button
            disabled={missingRequired}
            onClick={() =>
              onConfirm(Object.values(selected).flat())
            }
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-ink-300"
          >
            Thêm vào giỏ
          </button>
        </div>
      </div>
    </div>
  );
}
