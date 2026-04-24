"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getDeviceId, getGuestId, setGuestId } from "@/lib/device";
import { formatVND } from "@/lib/format";
import { SafeImg } from "@/components/SafeImg";
import { useDialog } from "@/components/DialogProvider";
import { OptionModal } from "@/components/customer/OptionModal";
import { MemoryWelcome, type MemoryProfile } from "@/components/customer/MemoryWelcome";
import { Spinner } from "@/components/Spinner";
import { useRealtime } from "@/lib/use-realtime";

type Restaurant = { id: string; name: string; tagline: string | null; logo: string | null };
type Table = { id: string; label: string; number: number };

type Category = {
  id: string;
  name: string;
  order: number;
  menuItems: MenuItem[];
};
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

type Guest = { id: string; nickname: string | null };

type CartItem = {
  id: string;
  quantity: number;
  note: string | null;
  optionsLabel: string | null;
  optionsPrice: number;
  menuItem: { id: string; name: string; price: number; image: string | null };
  guest: { id: string; nickname: string | null };
};

export default function CustomerApp({
  sessionToken,
  restaurant,
  table,
}: {
  sessionToken: string;
  restaurant: Restaurant;
  table: Table;
}) {
  const [guest, setGuest] = useState<Guest | null>(null);
  const [showNickname, setShowNickname] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [optionModalItem, setOptionModalItem] = useState<MenuItem | null>(null);
  const [memory, setMemory] = useState<MemoryProfile | null>(null);
  const [memoryDismissed, setMemoryDismissed] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [savingNickname, setSavingNickname] = useState(false);
  const [confirmingOptions, setConfirmingOptions] = useState(false);
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [view, setView] = useState<"menu" | "status">("menu");
  const [toast, setToast] = useState<string | null>(null);

  // Single SSE subscription drives cart/status refreshes. If the customer's
  // network blocks SSE (some hotel wifi / carrier proxies) we fall back to
  // pulse polling at 3s.
  const pulseVersion = useRealtime({
    restaurantId: restaurant.id,
    scope: "customer",
    sessionToken,
    fallbackIntervalMs: 3000,
  });

  // Register guest on mount. Don't auto-popup nickname dialog — user can tap header to set name.
  useEffect(() => {
    const device = getDeviceId();
    (async () => {
      const res = await fetch(`/api/session/${sessionToken}/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: device }),
      });
      if (res.ok) {
        const { guest: g } = await res.json();
        setGuest(g);
        setGuestId(sessionToken, g.id);

        // Load Memory profile for returning customers
        try {
          const mRes = await fetch(`/api/session/${sessionToken}/memory`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId: device }),
          });
          if (mRes.ok) {
            const { profile } = await mRes.json();
            if (profile && profile.visitCount >= 2) setMemory(profile);
          }
        } catch {
          /* noop — Memory is best-effort */
        }
      }
    })();
  }, [sessionToken]);

  // Load menu
  useEffect(() => {
    fetch(`/api/session/${sessionToken}/menu`)
      .then((r) => r.json())
      .then((d) => {
        setCategories(d.categories || []);
        if (d.categories?.[0]) setActiveCat(d.categories[0].id);
      });
  }, [sessionToken]);

  // Refresh cart when the server signals a change via the customer pulse.
  useEffect(() => {
    let alive = true;
    async function load() {
      const r = await fetch(`/api/session/${sessionToken}/cart`);
      if (!alive) return;
      if (r.ok) {
        const d = await r.json();
        setCart(d.items || []);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [sessionToken, pulseVersion]);

  // Toast
  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1500);
  }

  async function saveNickname(name: string) {
    if (savingNickname) return;
    setSavingNickname(true);
    try {
      const device = getDeviceId();
      const res = await fetch(`/api/session/${sessionToken}/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: device, nickname: name || undefined }),
      });
      if (res.ok) {
        const { guest: g } = await res.json();
        setGuest(g);
        setShowNickname(false);
      }
    } finally {
      setSavingNickname(false);
    }
  }

  async function reorderLast() {
    if (!guest || reordering) return;
    setReordering(true);
    const device = getDeviceId();
    const r = await fetch(`/api/session/${sessionToken}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: device, guestId: guest.id }),
    });
    setReordering(false);
    if (r.ok) {
      const d = await r.json();
      flash(`⚡ Đã thêm ${d.added} món vào giỏ`);
      setMemoryDismissed(true);
      setShowCart(true);
    } else {
      flash("Không thể gọi lại — menu đã đổi");
    }
  }

  async function addToCart(item: MenuItem) {
    if (!guest) return;
    // Items with options → open picker modal instead of adding directly
    if (item.optionGroups && item.optionGroups.length > 0) {
      setOptionModalItem(item);
      return;
    }
    // Optimistic (no-option fast path)
    const tmpId = `tmp_${Date.now()}`;
    setCart((prev) => {
      const same = prev.find(
        (c) =>
          c.menuItem.id === item.id &&
          c.guest.id === guest.id &&
          !c.note &&
          !c.optionsLabel,
      );
      if (same) {
        return prev.map((c) =>
          c.id === same.id ? { ...c, quantity: c.quantity + 1 } : c,
        );
      }
      return [
        ...prev,
        {
          id: tmpId,
          quantity: 1,
          note: null,
          optionsLabel: null,
          optionsPrice: 0,
          menuItem: { id: item.id, name: item.name, price: item.price, image: item.image },
          guest: { id: guest.id, nickname: guest.nickname ?? null },
        },
      ];
    });
    flash(`+ ${item.name}`);
    await fetch(`/api/session/${sessionToken}/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestId: guest.id, menuItemId: item.id, quantity: 1 }),
    });
  }

  async function confirmOptions({
    choiceIds,
    note,
    quantity,
  }: {
    choiceIds: string[];
    note: string;
    quantity: number;
  }) {
    if (!guest || !optionModalItem || confirmingOptions) return;
    const item = optionModalItem;
    setConfirmingOptions(true);
    try {
      await fetch(`/api/session/${sessionToken}/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId: guest.id,
          menuItemId: item.id,
          quantity,
          note: note || undefined,
          choiceIds,
        }),
      });
      setOptionModalItem(null);
      flash(`+ ${item.name}`);
    } finally {
      setConfirmingOptions(false);
    }
  }

  async function updateQty(ci: CartItem, delta: number) {
    const next = ci.quantity + delta;
    setCart((prev) => {
      if (next <= 0) return prev.filter((c) => c.id !== ci.id);
      return prev.map((c) => (c.id === ci.id ? { ...c, quantity: next } : c));
    });
    await fetch(`/api/session/${sessionToken}/cart/${ci.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity: Math.max(0, next) }),
    });
  }

  async function setNote(ci: CartItem, note: string) {
    setCart((prev) => prev.map((c) => (c.id === ci.id ? { ...c, note } : c)));
    await fetch(`/api/session/${sessionToken}/cart/${ci.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
  }

  async function submitOrder() {
    if (cart.length === 0 || submittingOrder) return;
    setSubmittingOrder(true);
    try {
      const res = await fetch(`/api/session/${sessionToken}/order`, { method: "POST" });
      if (res.ok) {
        setShowCart(false);
        setCart([]);
        flash("🍽️ Bếp đã nhận đơn!");
        setView("status");
      }
    } finally {
      setSubmittingOrder(false);
    }
  }

  const total = useMemo(
    () =>
      cart.reduce(
        (s, c) => s + (c.menuItem.price + (c.optionsPrice || 0)) * c.quantity,
        0,
      ),
    [cart],
  );
  const count = useMemo(() => cart.reduce((s, c) => s + c.quantity, 0), [cart]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 to-white pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-brand-600">
              {restaurant.name}
            </div>
            <div className="font-display text-xl font-bold leading-none text-ink-950">
              {table.label}
              {guest && (
                <button
                  onClick={() => setShowNickname(true)}
                  className="ml-2 align-middle rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 hover:bg-brand-200"
                >
                  {guest.nickname || "Đặt tên"}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("menu")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                view === "menu" ? "bg-ink-950 text-white" : "text-ink-600"
              }`}
            >
              Thực đơn
            </button>
            <button
              onClick={() => setView("status")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                view === "status" ? "bg-ink-950 text-white" : "text-ink-600"
              }`}
            >
              Đơn hàng
            </button>
          </div>
        </div>

        {view === "menu" && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pt-1 pb-4">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveCat(c.id);
                  document
                    .getElementById(`cat-${c.id}`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  activeCat === c.id
                    ? "bg-brand-600 text-white shadow"
                    : "bg-white text-ink-700 ring-1 ring-ink-200"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {view === "menu" ? (
        <>
          {memory && !memoryDismissed && (
            <div className="relative">
              <MemoryWelcome
                profile={memory}
                onReorder={reorderLast}
                reordering={reordering}
              />
              <button
                onClick={() => setMemoryDismissed(true)}
                aria-label="Đóng"
                className="absolute right-6 top-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/60 text-ink-700 hover:bg-white"
              >
                ✕
              </button>
            </div>
          )}
          <MenuList categories={categories} onAdd={addToCart} />
        </>
      ) : (
        <OrderStatus
          sessionToken={sessionToken}
          onBackToMenu={() => setView("menu")}
          pulseVersion={pulseVersion}
        />
      )}

      {/* Cart sticky bar */}
      {count > 0 && view === "menu" && (
        <button
          onClick={() => setShowCart(true)}
          className="animate-fade-up fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-2xl bg-ink-950 px-5 py-4 text-white shadow-2xl shadow-ink-950/30"
        >
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500 font-bold">
              {count}
            </span>
            <div className="text-left">
              <div className="text-xs text-ink-300">Tổng giỏ bàn</div>
              <div className="font-bold">{formatVND(total)}</div>
            </div>
          </div>
          <span className="rounded-full bg-brand-500 px-4 py-2 text-sm font-bold">Xem giỏ →</span>
        </button>
      )}

      {/* Nickname dialog */}
      {showNickname && (
        <NicknameDialog
          onSave={saveNickname}
          onSkip={() => setShowNickname(false)}
          saving={savingNickname}
        />
      )}

      {/* Option picker modal */}
      {optionModalItem && (
        <OptionModal
          item={optionModalItem}
          onClose={() => setOptionModalItem(null)}
          onConfirm={confirmOptions}
          submitting={confirmingOptions}
        />
      )}

      {/* Cart drawer */}
      {showCart && (
        <CartDrawer
          cart={cart}
          currentGuestId={guest?.id}
          onClose={() => setShowCart(false)}
          onInc={(c) => updateQty(c, 1)}
          onDec={(c) => updateQty(c, -1)}
          onNote={setNote}
          onSubmit={submitOrder}
          submitting={submittingOrder}
          total={total}
        />
      )}

      {/* Toast — bottom center, doesn't block menu reading */}
      {toast && (
        <div className="animate-bounce-in pointer-events-none fixed left-1/2 bottom-24 z-50 -translate-x-1/2 rounded-full bg-ink-950 px-5 py-2 text-sm font-semibold text-white shadow-xl">
          {toast}
        </div>
      )}

      {/* Footer link */}
      <div className="mt-10 px-4 text-center text-xs text-ink-400">
        Powered by{" "}
        <Link href="/" className="font-semibold text-brand-600">
          Servify
        </Link>
      </div>
    </main>
  );
}

function MenuList({
  categories,
  onAdd,
}: {
  categories: Category[];
  onAdd: (item: MenuItem) => void;
}) {
  if (categories.length === 0) {
    return (
      <div className="px-4 pt-4">
        <div className="mb-3 h-7 w-32 rounded bg-ink-100 shimmer" />
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <MenuCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="px-4 pt-4">
      {categories.map((cat) => (
        <section key={cat.id} id={`cat-${cat.id}`} className="mb-8 scroll-mt-32">
          <h2 className="mb-3 font-display text-2xl font-bold text-ink-950">{cat.name}</h2>
          <div className="grid gap-3">
            {cat.menuItems.map((item) => (
              <MenuCard key={item.id} item={item} onAdd={() => onAdd(item)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MenuCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-2xl border border-ink-100 bg-white p-3">
      <div className="h-24 w-24 flex-none rounded-xl bg-ink-100 shimmer" />
      <div className="flex flex-1 flex-col justify-between py-1">
        <div className="space-y-2">
          <div className="h-4 w-3/4 rounded bg-ink-100 shimmer" />
          <div className="h-3 w-1/2 rounded bg-ink-100 shimmer" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 rounded bg-ink-100 shimmer" />
          <div className="h-10 w-10 rounded-full bg-ink-100 shimmer" />
        </div>
      </div>
    </div>
  );
}

function MenuCard({ item, onAdd }: { item: MenuItem; onAdd: () => void }) {
  const [pulse, setPulse] = useState(false);
  function handleAdd() {
    onAdd();
    setPulse(true);
    setTimeout(() => setPulse(false), 450);
  }
  return (
    <div className="flex gap-4 rounded-2xl border border-ink-100 bg-white p-3 transition hover:border-brand-200 hover:shadow-md active:scale-[0.99]">
      <div className="relative h-24 w-24 flex-none overflow-hidden rounded-xl">
        <SafeImg
          src={item.image}
          alt={item.name}
          className="h-full w-full object-cover"
        />
        {!item.isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-bold text-white">
            HẾT MÓN
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <h3 className="font-semibold leading-tight text-ink-950">{item.name}</h3>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-xs text-ink-500">{item.description}</p>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="font-bold text-brand-700">{formatVND(item.price)}</span>
          <button
            onClick={handleAdd}
            disabled={!item.isAvailable}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white shadow-md shadow-brand-600/30 transition hover:bg-brand-700 active:scale-90 disabled:bg-ink-300 ${
              pulse ? "animate-bounce-in" : ""
            }`}
            aria-label={`Thêm ${item.name}`}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function NicknameDialog({
  onSave,
  onSkip,
  saving,
}: {
  onSave: (name: string) => void;
  onSkip: () => void;
  saving: boolean;
}) {
  const [name, setName] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="animate-fade-up w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="text-center">
          <div className="text-4xl">👋</div>
          <h2 className="mt-3 font-display text-2xl font-bold text-ink-950">Xin chào!</h2>
          <p className="mt-1 text-sm text-ink-600">
            Cho tụi mình biết tên gọi để các bạn cùng bàn thấy bạn gọi món gì.
          </p>
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ví dụ: Minh"
          disabled={saving}
          className="mt-6 w-full rounded-xl border border-ink-200 px-4 py-3 text-center text-lg outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 disabled:opacity-60"
        />
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            onClick={onSkip}
            disabled={saving}
            className="rounded-xl border border-ink-200 py-3 font-medium text-ink-700 disabled:opacity-50"
          >
            Bỏ qua
          </button>
          <button
            onClick={() => onSave(name.trim())}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 font-semibold text-white disabled:opacity-60"
          >
            {saving && <Spinner className="h-4 w-4" />}
            {saving ? "Đang lưu..." : "Xong"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartDrawer({
  cart,
  currentGuestId,
  onClose,
  onInc,
  onDec,
  onNote,
  onSubmit,
  submitting,
  total,
}: {
  cart: CartItem[];
  currentGuestId: string | undefined;
  onClose: () => void;
  onInc: (c: CartItem) => void;
  onDec: (c: CartItem) => void;
  onNote: (c: CartItem, note: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  total: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50">
      <div className="animate-fade-up flex max-h-[90vh] w-full flex-col rounded-t-3xl bg-white">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-ink-950">Giỏ hàng chung</h2>
            <p className="text-xs text-ink-500">Cả bàn cùng thấy giỏ này</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng giỏ hàng"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink-900 text-white hover:bg-ink-700"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {cart.length === 0 && (
            <div className="py-12 text-center text-ink-400">Giỏ trống — quay về menu nhé!</div>
          )}
          {cart.map((c) => (
            <CartRow
              key={c.id}
              item={c}
              canEdit={c.guest.id === currentGuestId}
              onInc={() => onInc(c)}
              onDec={() => onDec(c)}
              onNote={(n) => onNote(c, n)}
            />
          ))}
        </div>

        <div className="border-t border-ink-100 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-ink-600">Tổng cộng</span>
            <span className="font-display text-2xl font-bold text-brand-700">
              {formatVND(total)}
            </span>
          </div>
          <button
            onClick={onSubmit}
            disabled={cart.length === 0 || submitting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-4 text-lg font-bold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:opacity-40"
          >
            {submitting && <Spinner className="h-5 w-5" />}
            {submitting ? "Đang gửi đơn..." : "Gửi Order → Bếp"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartRow({
  item,
  canEdit,
  onInc,
  onDec,
  onNote,
}: {
  item: CartItem;
  canEdit: boolean;
  onInc: () => void;
  onDec: () => void;
  onNote: (note: string) => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNoteState] = useState(item.note || "");
  const by = item.guest.nickname || "Khách";
  return (
    <div className="mb-3 rounded-2xl bg-ink-50 p-3">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 flex-none overflow-hidden rounded-xl">
          <SafeImg
            src={item.menuItem.image}
            alt={item.menuItem.name}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex-1">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-ink-950">{item.menuItem.name}</span>
            <span className="font-bold text-brand-700">
              {formatVND((item.menuItem.price + (item.optionsPrice || 0)) * item.quantity)}
            </span>
          </div>
          {item.optionsLabel && (
            <div className="mt-0.5 text-xs text-ink-600">{item.optionsLabel}</div>
          )}
          <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-500">
            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-brand-700">{by}</span>
            {item.note && <span className="italic">· {item.note}</span>}
          </div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <button
          onClick={() => setShowNote((s) => !s)}
          className="text-xs font-medium text-ink-600 underline"
        >
          {item.note ? "Sửa ghi chú" : "+ Ghi chú"}
        </button>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onDec}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-ink-200"
            >
              −
            </button>
            <span className="min-w-[1.5rem] text-center font-semibold">{item.quantity}</span>
            <button
              onClick={onInc}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white"
            >
              +
            </button>
          </div>
        ) : (
          <span className="text-xs text-ink-400">×{item.quantity}</span>
        )}
      </div>
      {showNote && canEdit && (
        <div className="mt-2 flex gap-2">
          <input
            value={note}
            onChange={(e) => setNoteState(e.target.value)}
            placeholder="Không hành, ít cay..."
            className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-brand-500"
          />
          <button
            onClick={() => {
              onNote(note);
              setShowNote(false);
            }}
            className="rounded-lg bg-ink-950 px-3 py-1.5 text-sm text-white"
          >
            Lưu
          </button>
        </div>
      )}
    </div>
  );
}

function OrderStatus({
  sessionToken,
  onBackToMenu,
  pulseVersion,
}: {
  sessionToken: string;
  onBackToMenu: () => void;
  pulseVersion: number;
}) {
  const dialog = useDialog();
  type Round = {
    id: string;
    roundNumber: number;
    status: "IN_KITCHEN" | "SERVED";
    createdAt: string;
    items: {
      id: string;
      quantity: number;
      servedQty: number;
      note: string | null;
      priceAtOrder: number;
      optionsLabel: string | null;
      optionsPrice: number;
      menuItem: { name: string; image: string | null };
      guest: { nickname: string | null } | null;
    }[];
  };
  const [rounds, setRounds] = useState<Round[]>([]);
  const [billRequestedAt, setBillRequestedAt] = useState<string | null>(null);
  const [billBusy, setBillBusy] = useState(false);
  const loadedOnce = useRef(false);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [ordersRes, billRes] = await Promise.all([
        fetch(`/api/session/${sessionToken}/orders`),
        fetch(`/api/session/${sessionToken}/bill`),
      ]);
      if (!alive) return;
      if (ordersRes.ok) {
        const d = await ordersRes.json();
        setRounds(d.rounds || []);
        loadedOnce.current = true;
      }
      if (billRes.ok) {
        const d = await billRes.json();
        setBillRequestedAt(d.billRequestedAt ?? null);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [sessionToken, pulseVersion]);

  async function callBill() {
    if (billBusy) return;
    setBillBusy(true);
    const prev = billRequestedAt;
    setBillRequestedAt(new Date().toISOString());
    const r = await fetch(`/api/session/${sessionToken}/bill`, { method: "POST" });
    if (r.ok) {
      const d = await r.json();
      setBillRequestedAt(d.billRequestedAt);
      dialog.alert({
        icon: "🛎️",
        title: "Đã gọi nhân viên",
        message: "Xin đợi chút — nhân viên sẽ đến tính tiền trong giây lát.",
        tone: "success",
        confirmLabel: "Đã hiểu",
      });
    } else {
      setBillRequestedAt(prev);
      dialog.toast({ message: "Không gọi được — thử lại", type: "error" });
    }
    setBillBusy(false);
  }

  async function cancelBill() {
    if (billBusy) return;
    const ok = await dialog.confirm({
      icon: "↩️",
      title: "Huỷ gọi tính tiền?",
      message: "Nhân viên sẽ không đến tính tiền nữa.",
      confirmLabel: "Huỷ gọi",
      cancelLabel: "Giữ nguyên",
    });
    if (!ok) return;
    setBillBusy(true);
    const prev = billRequestedAt;
    setBillRequestedAt(null);
    const r = await fetch(`/api/session/${sessionToken}/bill`, { method: "DELETE" });
    if (!r.ok) {
      setBillRequestedAt(prev);
      dialog.toast({ message: "Không huỷ được — thử lại", type: "error" });
    }
    setBillBusy(false);
  }

  const grandTotal = rounds.reduce(
    (s, r) => s + r.items.reduce((a, i) => a + i.priceAtOrder * i.quantity, 0),
    0
  );

  if (loadedOnce.current && rounds.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="text-6xl">🍜</div>
        <p className="mt-4 text-ink-600">Chưa có đơn nào được gửi.</p>
        <button
          onClick={onBackToMenu}
          className="mt-5 rounded-full bg-brand-600 px-6 py-3 font-semibold text-white"
        >
          Về thực đơn
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4">
      {rounds.map((r) => (
        <div
          key={r.id}
          className="mb-4 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-ink-500">Lượt gọi</div>
              <div className="font-display text-xl font-bold">#{r.roundNumber}</div>
            </div>
            {r.status === "SERVED" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                ✓ Đã phục vụ đủ
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
                <span className="inline-block h-2 w-2 animate-pulsebar rounded-full bg-amber-600" />
                Đang nấu
              </span>
            )}
          </div>
          <ul className="mt-3 divide-y divide-ink-100">
            {r.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between py-2">
                <div>
                  <div className="font-medium text-ink-900">
                    {it.menuItem.name} <span className="text-ink-500">×{it.quantity}</span>
                  </div>
                  {it.optionsLabel && (
                    <div className="text-xs text-ink-600">{it.optionsLabel}</div>
                  )}
                  <div className="text-xs text-ink-500">
                    {it.guest?.nickname || "Khách"}
                    {it.note && <span className="italic"> · {it.note}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">
                    {formatVND(it.priceAtOrder * it.quantity)}
                  </div>
                  <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                    Đã ra {it.servedQty}/{it.quantity}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="mt-4 rounded-2xl bg-ink-950 p-5 text-white">
        <div className="flex items-baseline justify-between">
          <span className="text-ink-300">Tạm tính</span>
          <span className="font-display text-2xl font-bold">{formatVND(grandTotal)}</span>
        </div>
        <p className="mt-1 text-xs text-ink-400">Thanh toán tại quầy (tiền mặt hoặc chuyển khoản)</p>
      </div>

      {billRequestedAt && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-full bg-amber-200 text-xl">
              🛎️
            </span>
            <div>
              <div className="font-semibold text-amber-900">Đã gọi tính tiền</div>
              <div className="text-xs text-amber-800">
                Nhân viên sẽ đến bàn trong giây lát.
              </div>
            </div>
          </div>
          <button
            onClick={cancelBill}
            disabled={billBusy}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-50"
          >
            Huỷ
          </button>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          onClick={onBackToMenu}
          className="rounded-2xl bg-brand-600 py-4 font-bold text-white"
        >
          + Gọi thêm món
        </button>
        <button
          onClick={callBill}
          disabled={billBusy || !!billRequestedAt}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-ink-300 bg-white py-4 font-bold text-ink-950 disabled:cursor-not-allowed disabled:bg-ink-100 disabled:text-ink-500"
        >
          {billBusy && <Spinner className="h-4 w-4" />}
          {billBusy
            ? "Đang gọi..."
            : billRequestedAt
              ? "🛎️ Đã gọi tính tiền"
              : "🛎️ Gọi tính tiền"}
        </button>
      </div>
    </div>
  );
}
