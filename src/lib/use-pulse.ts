"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lightweight "has anything changed for this tenant" subscription.
 *
 * Polls GET /api/restaurant/:id/pulse?scope=… every `intervalMs` with an
 * `If-None-Match` header. The server returns 304 (no body) when nothing
 * moved, so the only cost on the steady state is one tiny indexed DB read
 * per instance per poll — a fraction of the old "fetch full list every 3s"
 * pattern.
 *
 * Consumers get a `version` number that increments when the server bumps
 * the counter; pair it with useEffect to refetch heavy data only when it
 * actually changes.
 */
export function usePulse(params: {
  restaurantId: string;
  scope: "kitchen" | "tables" | "menu" | "customer";
  intervalMs?: number;
  sessionToken?: string; // for customer scope (customer screens don't have staff auth)
  enabled?: boolean;
}): number {
  const { restaurantId, scope, intervalMs = 3000, sessionToken, enabled = true } = params;
  const [version, setVersion] = useState(0);
  const etagRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !restaurantId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const url =
      `/api/restaurant/${restaurantId}/pulse?scope=${scope}` +
      (sessionToken ? `&token=${encodeURIComponent(sessionToken)}` : "");

    async function tick() {
      if (!alive) return;
      try {
        const headers: Record<string, string> = {};
        if (etagRef.current) headers["If-None-Match"] = etagRef.current;
        const res = await fetch(url, { headers, cache: "no-store" });
        if (res.status === 304) {
          // nothing changed
        } else if (res.ok) {
          const etag = res.headers.get("ETag");
          if (etag) etagRef.current = etag;
          const data = await res.json().catch(() => null);
          if (alive && data && typeof data.version === "number") {
            setVersion(data.version);
          }
        }
      } catch {
        /* network blip — keep polling */
      }
      if (alive) {
        // Pause polling while the tab is hidden to conserve DB/battery.
        const delay = document.hidden ? Math.max(intervalMs, 15_000) : intervalMs;
        timer = setTimeout(tick, delay);
      }
    }

    tick();
    const onVis = () => {
      if (!document.hidden && alive) {
        if (timer) clearTimeout(timer);
        tick();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [restaurantId, scope, intervalMs, sessionToken, enabled]);

  return version;
}
