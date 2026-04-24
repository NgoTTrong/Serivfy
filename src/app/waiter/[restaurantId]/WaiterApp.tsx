"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime, formatVND, waitMinutes } from "@/lib/format";
import { useDialog } from "@/components/DialogProvider";
import { CashierDrawer } from "@/components/CashierDrawer";
import { useRealtime } from "@/lib/use-realtime";

type Item = {
  id: string;
  quantity: number;
  servedQty: number;
  note: string | null;
  priceAtOrder: number;
  optionsLabel: string | null;
  optionsPrice: number;
  menuItem: { name: string };
  guest: { nickname: string | null } | null;
};
type Round = {
  id: string;
  roundNumber: number;
  createdAt: string;
  status: "IN_KITCHEN" | "SERVED";
  session: { id: string; table: { id: string; label: string; number: number } };
  items: Item[];
};

type TableStatus = {
  id: string;
  number: number;
  label: string;
  capacity: number;
  qrToken: string;
  activeSession: null | {
    id: string;
    token: string;
    openedAt: string;
    guestCount: number;
    pendingCount: number;
    totalRounds: number;
    revenue: number;
    billRequestedAt: string | null;
    memory: null | {
      badge: "NEW" | "RETURNING" | "REGULAR" | "LOYAL" | "VIP";
      visitCount: number;
      totalSpent: number;
      nickname: string | null;
    };
  };
};

export default function WaiterApp({
  restaurantId,
  staffName,
}: {
  restaurantId: string;
  staffName: string;
}) {
  const dialog = useDialog();
  const [tab, setTab] = useState<"orders" | "tables">("orders");
  const [rounds, setRounds] = useState<Round[]>([]);
  const [tables, setTables] = useState<TableStatus[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [cashier, setCashier] = useState<TableStatus | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevBillKeys = useRef<Set<string>>(new Set());
  const seededBills = useRef(false);
  const prevRoundIds = useRef<Set<string>>(new Set());
  const seededRounds = useRef(false);

  // Waiter watches the "tables" scope (bill requests, new sessions, round
  // status) — all mutations that affect waiter view bump that scope too.
  const pulseVersion = useRealtime({ restaurantId, scope: "tables", fallbackIntervalMs: 3000 });

  useEffect(() => {
    let alive = true;
    async function load() {
      const [a, b] = await Promise.all([
        fetch(`/api/restaurant/${restaurantId}/orders/pending`).then((r) => r.json()),
        fetch(`/api/restaurant/${restaurantId}/tables/status`).then((r) => r.json()),
      ]);
      if (!alive) return;
      const nextTables: TableStatus[] = b.tables || [];
      const nextBillKeys = new Set<string>();
      for (const t of nextTables) {
        if (t.activeSession?.billRequestedAt) {
          nextBillKeys.add(`${t.activeSession.id}:${t.activeSession.billRequestedAt}`);
        }
      }
      if (seededBills.current) {
        for (const k of nextBillKeys) {
          if (!prevBillKeys.current.has(k)) {
            chime("bill");
            break;
          }
        }
      }
      prevBillKeys.current = nextBillKeys;
      seededBills.current = true;

      const nextRounds: Round[] = a.rounds || [];
      const nextRoundIds = new Set(nextRounds.map((r) => r.id));
      if (seededRounds.current) {
        for (const id of nextRoundIds) {
          if (!prevRoundIds.current.has(id)) {
            chime("order");
            break;
          }
        }
      }
      prevRoundIds.current = nextRoundIds;
      seededRounds.current = true;

      setRounds(nextRounds);
      setTables(nextTables);
      setLoaded(true);
    }
    load();
    return () => {
      alive = false;
    };
  }, [restaurantId, pulseVersion]);

  function enableSound() {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, ctx.currentTime);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.01);
      setSoundOn(true);
    } catch {}
  }

  function chime(kind: "order" | "bill" = "order") {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      if (kind === "bill") {
        // Urgent triple ascending ding for bill request
        o.frequency.setValueAtTime(880, ctx.currentTime);
        o.frequency.setValueAtTime(1175, ctx.currentTime + 0.1);
        o.frequency.setValueAtTime(1568, ctx.currentTime + 0.22);
        g.gain.setValueAtTime(0.22, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.65);
        o.start();
        o.stop(ctx.currentTime + 0.65);
      } else {
        // Softer two-note for new order ready
        o.frequency.setValueAtTime(660, ctx.currentTime);
        o.frequency.setValueAtTime(990, ctx.currentTime + 0.1);
        g.gain.setValueAtTime(0.15, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        o.start();
        o.stop(ctx.currentTime + 0.4);
      }
    } catch {}
  }

  async function serve(itemId: string, delta: number) {
    setRounds((prev) =>
      prev.map((r) => ({
        ...r,
        items: r.items.map((it) =>
          it.id === itemId
            ? { ...it, servedQty: Math.max(0, Math.min(it.quantity, it.servedQty + delta)) }
            : it
        ),
      }))
    );
    await fetch(`/api/order-item/${itemId}/serve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta }),
    });
  }

  function openCashier(t: TableStatus) {
    if (!t.activeSession) return;
    setCashier(t);
  }

  function onCashierClosed() {
    if (!cashier) return;
    setTables((prev) =>
      prev.map((t) => (t.id === cashier.id ? { ...t, activeSession: null } : t))
    );
    setCashier(null);
  }

  const pendingCount = rounds.reduce(
    (s, r) => s + r.items.reduce((a, i) => a + (i.quantity - i.servedQty), 0),
    0
  );
  const billCount = tables.filter((t) => t.activeSession?.billRequestedAt).length;

  return (
    <main className="min-h-screen bg-ink-900 text-ink-50">
      <header className="flex items-center justify-between border-b border-ink-800 bg-ink-950 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            🛎️
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-brand-400">
              Waiter Tablet
            </div>
            <div className="font-display text-2xl font-bold">Servify · Phục vụ</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTab("orders")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === "orders" ? "bg-brand-600 text-white" : "bg-ink-800 text-ink-200"
            }`}
          >
            Cần mang ra
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs text-white">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("tables")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              tab === "tables" ? "bg-brand-600 text-white" : "bg-ink-800 text-ink-200"
            }`}
          >
            Bàn
            {billCount > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-xs font-bold text-ink-950">
                🛎️ {billCount}
              </span>
            )}
          </button>
          <a
            href={`/pos/${restaurantId}`}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            🧾 POS
          </a>
          {!soundOn ? (
            <button
              onClick={enableSound}
              title="Bật để nghe chuông báo khi khách gọi tính tiền hoặc order mới"
              className="group relative rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-ink-950 hover:bg-amber-400"
            >
              🔔 Bật chuông
              <span className="pointer-events-none absolute left-1/2 top-full mt-2 w-56 -translate-x-1/2 rounded-lg bg-ink-950 px-3 py-2 text-[11px] font-normal text-ink-100 opacity-0 shadow-xl transition group-hover:opacity-100">
                Trình duyệt chặn âm thanh cho đến khi bạn bấm nút này. Bấm 1 lần đầu ca để
                nghe chuông khi có order / tính tiền.
              </span>
            </button>
          ) : (
            <span
              title="Đang nghe: order mới + khách gọi tính tiền"
              className="inline-flex items-center gap-1 rounded-full bg-green-600/20 px-3 py-1.5 text-xs text-green-300"
            >
              <span className="h-2 w-2 animate-pulsebar rounded-full bg-green-400" />
              Chuông ON
            </span>
          )}
          <span className="text-sm text-ink-400">· {staffName}</span>
          <form action="/api/auth/logout" method="post">
            <button className="rounded-full bg-ink-800 px-4 py-2 text-sm text-ink-200 hover:bg-ink-700">
              Đăng xuất
            </button>
          </form>
        </div>
      </header>

      <div className="p-5">
        {!loaded ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl bg-ink-800 shimmer" />
            ))}
          </div>
        ) : tab === "orders" ? (
          <OrdersBoard rounds={rounds} onServe={serve} />
        ) : (
          <TablesBoard tables={tables} onOpenCashier={openCashier} />
        )}
      </div>

      {cashier?.activeSession && (
        <CashierDrawer
          sessionToken={cashier.activeSession.token}
          tableId={cashier.id}
          tableLabel={cashier.label}
          pendingCount={cashier.activeSession.pendingCount}
          onClose={() => setCashier(null)}
          onClosed={onCashierClosed}
        />
      )}
    </main>
  );
}

function OrdersBoard({
  rounds,
  onServe,
}: {
  rounds: Round[];
  onServe: (id: string, delta: number) => void;
}) {
  if (rounds.length === 0) {
    return (
      <div className="mt-16 text-center text-ink-400">
        <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-ink-800 text-4xl">☕</div>
        <p className="mt-5 font-display text-xl">Không có đơn chờ phục vụ.</p>
        <p className="mt-1 text-sm text-ink-500">Đi dạo 1 vòng kiểm tra bàn nhé — hoặc bếp sắp ra đơn mới.</p>
      </div>
    );
  }

  // group by table
  const byTable = new Map<string, Round[]>();
  for (const r of rounds) {
    const k = r.session.table.id;
    if (!byTable.has(k)) byTable.set(k, []);
    byTable.get(k)!.push(r);
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from(byTable.entries()).map(([tableId, rs]) => (
        <div key={tableId} className="rounded-2xl bg-ink-800 p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-display text-xl font-bold">{rs[0].session.table.label}</h3>
            <span className="text-xs text-ink-400">{rs.length} lượt</span>
          </div>
          {rs.map((r) => (
            <RoundBlock key={r.id} round={r} onServe={onServe} />
          ))}
        </div>
      ))}
    </div>
  );
}

function RoundBlock({
  round,
  onServe,
}: {
  round: Round;
  onServe: (id: string, delta: number) => void;
}) {
  const waited = waitMinutes(round.createdAt);
  return (
    <div className="mb-3 rounded-xl bg-ink-900 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold">Lượt #{round.roundNumber}</span>
        <span className="text-ink-400">
          {formatTime(round.createdAt)} · {waited}p
        </span>
      </div>
      {round.items.map((it) => {
        const done = it.servedQty >= it.quantity;
        return (
          <div
            key={it.id}
            className={`mb-2 flex items-center gap-3 rounded-lg p-2 ${
              done ? "bg-green-900/20 text-ink-300" : "bg-ink-800"
            }`}
          >
            <button
              onClick={() => onServe(it.id, done ? -1 : 1)}
              className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl text-xl font-bold transition-all duration-200 active:scale-90 ${
                done
                  ? "animate-bounce-in bg-green-500 text-white shadow-lg shadow-green-500/40"
                  : "border-2 border-ink-500 bg-ink-950 text-ink-500 hover:border-brand-400 hover:text-brand-400"
              }`}
              aria-label={done ? "Huỷ tick" : "Đánh dấu đã phục vụ"}
            >
              {done ? "✓" : ""}
            </button>
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{it.menuItem.name}</span>
                <span className="text-sm text-ink-300">
                  {it.servedQty}/{it.quantity}
                </span>
              </div>
              {it.optionsLabel && (
                <div className="text-xs text-brand-300">{it.optionsLabel}</div>
              )}
              <div className="flex items-center gap-2 text-xs text-ink-400">
                {it.guest?.nickname && <span>{it.guest.nickname}</span>}
                {it.note && <span className="italic text-amber-300">· {it.note}</span>}
              </div>
            </div>
            {it.servedQty > 0 && !done && (
              <button
                onClick={() => onServe(it.id, -1)}
                className="text-xs text-ink-400 underline"
              >
                undo
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TablesBoard({
  tables,
  onOpenCashier,
}: {
  tables: TableStatus[];
  onOpenCashier: (t: TableStatus) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
      {tables.map((t) => {
        const active = t.activeSession;
        const billCalled = !!active?.billRequestedAt;
        return (
          <div
            key={t.id}
            className={`relative rounded-2xl p-5 ${
              billCalled
                ? "bg-gradient-to-br from-amber-500 to-amber-700 text-white ring-2 ring-amber-300"
                : active
                  ? "bg-gradient-to-br from-brand-700 to-brand-900 text-white"
                  : "bg-ink-800"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest opacity-75">
                  Sức chứa {t.capacity}
                </div>
                <div className="font-display text-2xl font-bold">{t.label}</div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  billCalled
                    ? "bg-white text-amber-800"
                    : active
                      ? "bg-white/20 text-white"
                      : "bg-ink-700 text-ink-300"
                }`}
              >
                {billCalled ? "🛎️ Tính tiền" : active ? "Có khách" : "Trống"}
              </span>
            </div>
            {active ? (
              <>
                {active.memory && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-white/25 px-3 py-2 text-xs font-semibold">
                    <span className="text-lg leading-none">
                      {active.memory.badge === "VIP"
                        ? "👑"
                        : active.memory.badge === "LOYAL"
                          ? "💛"
                          : active.memory.badge === "REGULAR"
                            ? "🔖"
                            : "🎉"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div>
                        {active.memory.nickname ?? "Khách"} ·{" "}
                        <span className="opacity-80">lần {active.memory.visitCount}</span>
                      </div>
                      <div className="text-[10px] opacity-75">
                        Đã chi {formatVND(active.memory.totalSpent)} · hãy chào thân tình
                      </div>
                    </div>
                  </div>
                )}
                {billCalled && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-white/25 px-3 py-2 text-sm font-semibold">
                    <span className="inline-block h-2 w-2 animate-pulsebar rounded-full bg-white" />
                    🛎️ Gọi tính tiền · {waitMinutes(active.billRequestedAt!)}p
                  </div>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <Stat label="Khách" value={String(active.guestCount)} />
                  <Stat label="Lượt" value={String(active.totalRounds)} />
                  <Stat label="Chờ ra" value={String(active.pendingCount)} />
                </div>
                <div className="mt-3 rounded-xl bg-black/30 p-3 text-sm">
                  <div className="opacity-80">Tạm tính</div>
                  <div className="font-display text-xl font-bold">
                    {formatVND(active.revenue)}
                  </div>
                </div>
                <button
                  onClick={() => onOpenCashier(t)}
                  className={`mt-3 w-full rounded-xl py-3 font-semibold hover:bg-ink-100 ${
                    billCalled ? "bg-white text-amber-800" : "bg-white text-brand-700"
                  }`}
                >
                  🧾 Thu ngân
                </button>
              </>
            ) : (
              <div className="mt-6 text-sm opacity-75">Sẵn sàng cho khách quét QR.</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/20 py-2">
      <div className="font-display text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase opacity-70">{label}</div>
    </div>
  );
}
