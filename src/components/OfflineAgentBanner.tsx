"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Agent = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
};

const OFFLINE_THRESHOLD_MS = 2 * 60_000;

export function OfflineAgentBanner() {
  const pathname = usePathname();
  const restaurantId = pathname.match(/^\/admin\/([^/]+)/)?.[1] ?? null;
  const [offline, setOffline] = useState<Agent[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    let alive = true;
    async function load() {
      try {
        const r = await fetch("/api/admin/print/agents", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (!alive) return;
        const now = Date.now();
        const down = (d.agents as Agent[]).filter((a) => {
          if (a.revokedAt) return false;
          if (!a.lastSeenAt) return true;
          return now - new Date(a.lastSeenAt).getTime() > OFFLINE_THRESHOLD_MS;
        });
        setOffline(down);
        setLoaded(true);
      } catch {
        /* swallow */
      }
    }
    load();
    // 30s is enough — this banner is informational; SSE/pulse handle anything
    // time-sensitive elsewhere in the app.
    const iv = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [restaurantId]);

  if (!loaded || offline.length === 0 || !restaurantId) return null;

  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <span>
          🖨️ <strong>Máy quầy offline</strong>
          {offline.length > 1 ? ` (${offline.length} máy)` : ""}:
          {" "}
          {offline.map((a) => a.name).join(", ")} — hoá đơn và ticket bếp sẽ
          chờ trong hàng đợi.
        </span>
        <Link
          href={`/admin/${restaurantId}/printers`}
          className="rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
        >
          Kiểm tra
        </Link>
      </div>
    </div>
  );
}
