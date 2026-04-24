"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDialog } from "@/components/DialogProvider";
import { useRealtime } from "@/lib/use-realtime";
import { formatVND } from "@/lib/format";

type Table = {
  id: string;
  number: number;
  label: string;
  capacity: number;
  activeSession: null | {
    id: string;
    token: string;
    openedAt: string;
    guestCount: number;
    pendingCount: number;
    totalRounds: number;
    revenue: number;
    billRequestedAt: string | null;
  };
};

export default function PosGrid({ restaurantId }: { restaurantId: string }) {
  const router = useRouter();
  const dialog = useDialog();
  const [tables, setTables] = useState<Table[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const pulse = useRealtime({ restaurantId, scope: "tables", fallbackIntervalMs: 4000 });

  useEffect(() => {
    let alive = true;
    async function load() {
      const r = await fetch(`/api/restaurant/${restaurantId}/tables/status`);
      if (!alive) return;
      if (r.ok) {
        const d = await r.json();
        setTables(d.tables || []);
        setLoaded(true);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [restaurantId, pulse]);

  async function openTable(t: Table) {
    if (busy) return;
    setBusy(t.id);
    try {
      const r = await fetch("/api/admin/pos/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: t.id }),
      });
      if (!r.ok) {
        dialog.toast({ message: "Không mở được bàn", type: "error" });
        return;
      }
      const d = await r.json();
      router.push(`/pos/${restaurantId}/${d.sessionToken}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">POS</h1>
          <p className="text-sm text-ink-500">
            Nhận đặt món hộ khách. Chọn bàn để bắt đầu gọi món.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {!loaded &&
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl border border-ink-100 bg-white shimmer" />
          ))}
        {loaded && tables.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-ink-200 p-10 text-center text-ink-500">
            Chưa có bàn nào. Vào mục <strong>Bàn &amp; QR</strong> để thêm.
          </div>
        )}
        {loaded &&
          tables.map((t) => {
            const occupied = !!t.activeSession;
            return (
              <button
                key={t.id}
                onClick={() => openTable(t)}
                disabled={busy === t.id}
                className={`group relative overflow-hidden rounded-2xl border bg-white p-4 text-left transition hover:shadow-md ${
                  occupied
                    ? "border-brand-200 bg-brand-50/40"
                    : "border-ink-100 hover:border-brand-200"
                } ${busy === t.id ? "opacity-60" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl font-display text-xl font-bold ${
                      occupied
                        ? "bg-gradient-to-br from-brand-500 to-brand-600 text-white"
                        : "bg-ink-100 text-ink-600"
                    }`}
                  >
                    {t.number}
                  </div>
                  {occupied && t.activeSession!.billRequestedAt && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      🛎️ gọi tính
                    </span>
                  )}
                </div>
                <div className="mt-3 font-semibold">{t.label}</div>
                <div className="text-xs text-ink-500">{t.capacity} khách</div>

                {occupied && t.activeSession && (
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between text-ink-600">
                      <span>Khách:</span>
                      <span className="font-semibold">{t.activeSession.guestCount}</span>
                    </div>
                    <div className="flex justify-between text-ink-600">
                      <span>Tổng:</span>
                      <span className="font-semibold">{formatVND(t.activeSession.revenue)}</span>
                    </div>
                    {t.activeSession.pendingCount > 0 && (
                      <div className="flex justify-between text-amber-700">
                        <span>Chờ phục vụ:</span>
                        <span className="font-semibold">{t.activeSession.pendingCount}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-3 rounded-full bg-brand-600 px-3 py-1.5 text-center text-xs font-semibold text-white">
                  {occupied ? "Mở menu gọi món" : "Mở bàn & gọi món"}
                </div>
              </button>
            );
          })}
      </div>
    </div>
  );
}
