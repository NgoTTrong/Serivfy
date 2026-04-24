"use client";

import { useEffect, useRef, useState } from "react";
import { formatTime, waitMinutes } from "@/lib/format";
import { useRealtime } from "@/lib/use-realtime";

type Item = {
  id: string;
  quantity: number;
  servedQty: number;
  note: string | null;
  optionsLabel: string | null;
  menuItem: { name: string };
  guest: { nickname: string | null } | null;
};
type Round = {
  id: string;
  roundNumber: number;
  createdAt: string;
  status: "IN_KITCHEN" | "SERVED";
  session: { id: string; table: { label: string; number: number } };
  items: Item[];
};

export default function KitchenScreen({
  restaurantId,
  staffName,
}: {
  restaurantId: string;
  staffName: string;
}) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const prevIds = useRef<Set<string>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);

  // SSE drives refetches: the heavy kitchen query only runs on initial load
  // and when the server signals something changed (new round, serve update).
  // Falls back to polling if SSE fails (corporate proxy, browser block).
  const pulseVersion = useRealtime({ restaurantId, scope: "kitchen", fallbackIntervalMs: 2500 });

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`/api/restaurant/${restaurantId}/kitchen`);
        if (!r.ok) throw new Error();
        const d = await r.json();
        if (!alive) return;
        const newRounds: Round[] = d.rounds || [];
        const seen = prevIds.current;
        const incoming = new Set(newRounds.map((r) => r.id));
        let hasNew = false;
        for (const id of incoming) {
          if (!seen.has(id) && seen.size > 0) hasNew = true;
        }
        if (hasNew) chime();
        prevIds.current = incoming;
        setRounds(newRounds);
        setLoaded(true);
        setErr(null);
      } catch {
        if (alive) setErr("Mất kết nối. Đang thử lại...");
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [restaurantId, pulseVersion]);

  function enableSound() {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new Ctx();
      // Prime context with a silent blip so subsequent chimes pass autoplay policy.
      const o = audioCtxRef.current.createOscillator();
      const g = audioCtxRef.current.createGain();
      g.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      o.connect(g);
      g.connect(audioCtxRef.current.destination);
      o.start();
      o.stop(audioCtxRef.current.currentTime + 0.01);
      setSoundOn(true);
    } catch {}
  }

  function chime() {
    if (!audioCtxRef.current) return;
    try {
      const ctx = audioCtxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      o.start();
      o.stop(ctx.currentTime + 0.5);
    } catch {}
  }

  return (
    <main className="min-h-screen bg-ink-950 text-white">
      <header className="flex items-center justify-between border-b border-ink-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600">
            🍳
          </span>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-brand-400">
              Kitchen Display
            </div>
            <div className="font-display text-2xl font-bold">Servify · KDS</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-ink-300">
          <span>Xin chào, {staffName}</span>
          <Clock />
          {!soundOn ? (
            <button
              onClick={enableSound}
              className="rounded-full bg-amber-500 px-4 py-1.5 font-semibold text-ink-950 hover:bg-amber-400"
            >
              🔔 Bật chuông
            </button>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-600/20 px-3 py-1.5 text-green-300">
              <span className="h-2 w-2 animate-pulsebar rounded-full bg-green-400" />
              Chuông ON
            </span>
          )}
          <form action="/api/auth/logout" method="post">
            <button className="rounded-full bg-ink-800 px-4 py-1.5 text-ink-200 hover:bg-ink-700">
              Đăng xuất
            </button>
          </form>
        </div>
      </header>

      {err && <div className="bg-red-800/40 px-6 py-2 text-center text-sm">{err}</div>}

      <section className="p-4">
        {!loaded ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl border-2 border-ink-800 bg-ink-900/50 shimmer" />
            ))}
          </div>
        ) : rounds.length === 0 ? (
          <div className="mt-24 flex flex-col items-center text-ink-400">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-ink-800 text-4xl">🍳</div>
            <p className="mt-5 font-display text-xl">Hiện không có order nào chờ nấu.</p>
            <p className="mt-1 text-sm text-ink-500">Thư giãn chút, order mới sẽ tự xuất hiện ở đây.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rounds.map((r) => (
              <OrderCard key={r.id} round={r} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function OrderCard({ round }: { round: Round }) {
  const waited = waitMinutes(round.createdAt);
  const color =
    waited < 5
      ? "border-green-500/70 bg-green-900/10"
      : waited < 10
      ? "border-amber-500/70 bg-amber-900/20"
      : "border-red-500/80 bg-red-900/30";

  const badgeColor =
    waited < 5 ? "bg-green-500" : waited < 10 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className={`rounded-2xl border-2 p-5 shadow-lg ${color}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-ink-400">
            {round.session.table.label} · Lượt #{round.roundNumber}
          </div>
          <div className="font-display text-3xl font-bold">Bàn {round.session.table.number}</div>
        </div>
        <div className={`rounded-full px-3 py-1 text-sm font-bold ${badgeColor} text-white`}>
          {waited < 1 ? "< 1p" : `${waited}p`}
        </div>
      </div>
      <div className="mt-2 text-xs text-ink-400">Gửi lúc {formatTime(round.createdAt)}</div>

      <ul className="mt-4 space-y-2">
        {round.items.map((it) => {
          const remaining = it.quantity - it.servedQty;
          return (
            <li
              key={it.id}
              className="flex items-start justify-between gap-3 border-t border-ink-700 pt-2"
            >
              <div>
                <div className="text-lg font-semibold">
                  {it.menuItem.name}
                  {it.servedQty > 0 && (
                    <span className="ml-2 text-xs text-ink-400">
                      ({it.servedQty}/{it.quantity} đã ra)
                    </span>
                  )}
                </div>
                {it.optionsLabel && (
                  <div className="mt-0.5 text-sm font-medium text-brand-300">
                    → {it.optionsLabel}
                  </div>
                )}
                {it.note && (
                  <div className="mt-0.5 text-sm italic text-amber-300">⚠ {it.note}</div>
                )}
              </div>
              <div className="font-display text-3xl font-bold text-brand-400">×{remaining}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("vi-VN"));
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date().toLocaleTimeString("vi-VN")), 1000);
    return () => clearInterval(iv);
  }, []);
  return <span className="font-mono text-ink-200">{time}</span>;
}
