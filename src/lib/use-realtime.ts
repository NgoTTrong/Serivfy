"use client";

import { useEffect, useRef, useState } from "react";
import { usePulse } from "./use-pulse";

export type RealtimeScope = "kitchen" | "tables" | "menu" | "customer";

/**
 * Server-sent events subscription that returns an incrementing `version`
 * number. Consumers pair this with `useEffect(..., [version])` so heavy
 * data fetches only run when the server signals something changed.
 *
 * Transport:
 *   1. Opens /api/realtime/:id/stream?scope=… via EventSource.
 *   2. EventSource auto-reconnects on transient failures; we also track
 *      repeated failures and fall back to the /pulse polling endpoint if
 *      the SSE route stays unreachable (restrictive proxy, browser blocks).
 *
 * The fallback uses `usePulse` under the hood so the UX stays identical —
 * slightly higher latency, same contract.
 */
export function useRealtime(params: {
  restaurantId: string;
  scope: RealtimeScope;
  sessionToken?: string;
  enabled?: boolean;
  /** Polling interval used only if SSE falls back to pulse polling. */
  fallbackIntervalMs?: number;
}): number {
  const {
    restaurantId,
    scope,
    sessionToken,
    enabled = true,
    fallbackIntervalMs = 3000,
  } = params;

  const [version, setVersion] = useState(0);
  const [sseAvailable, setSseAvailable] = useState(true);

  // When SSE fails to connect repeatedly, this hook delegates to usePulse.
  // It's always wired up, but disabled while SSE is healthy so we don't
  // double-fetch.
  const fallbackVersion = usePulse({
    restaurantId,
    scope,
    intervalMs: fallbackIntervalMs,
    sessionToken,
    enabled: enabled && !sseAvailable,
  });

  useEffect(() => {
    if (!enabled || !restaurantId || !sseAvailable) return;
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      setSseAvailable(false);
      return;
    }

    const url =
      `/api/realtime/${restaurantId}/stream?scope=${scope}` +
      (sessionToken ? `&token=${encodeURIComponent(sessionToken)}` : "");

    let es: EventSource | null = null;
    let consecutiveFailures = 0;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource(url, { withCredentials: true });
      es.onmessage = (ev) => {
        consecutiveFailures = 0;
        try {
          const data = JSON.parse(ev.data) as { version?: number };
          if (typeof data.version === "number") setVersion(data.version);
        } catch {
          /* ignore malformed event */
        }
      };
      es.onerror = () => {
        consecutiveFailures += 1;
        // Three failed attempts in a row → treat as unsupported and fall
        // back to polling. EventSource will keep retrying in the background
        // but we stop listening so we don't double up.
        if (consecutiveFailures >= 3) {
          es?.close();
          es = null;
          setSseAvailable(false);
          return;
        }
        // Let the browser's built-in retry handle short blips. It uses the
        // `retry:` hint the server sends (3s).
      };
    };

    connect();

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      es?.close();
    };
  }, [restaurantId, scope, sessionToken, enabled, sseAvailable]);

  return sseAvailable ? version : fallbackVersion;
}
