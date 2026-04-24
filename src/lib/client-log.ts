/**
 * Fire-and-forget browser error reporter. Posts to /api/log so the error
 * shows up in Axiom alongside server-side logs — single place to debug.
 *
 * Uses `navigator.sendBeacon` when available so reports sent during page
 * unload still go through; falls back to `fetch(keepalive: true)`.
 */
export type ClientLogPayload = {
  event?: string;
  severity?: "info" | "warn" | "critical";
  message: string;
  stack?: string;
  digest?: string;
  route?: string;
  tenantId?: string;
  extra?: Record<string, unknown>;
};

export function reportClientError(p: ClientLogPayload): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({
    ...p,
    url: window.location.href,
    userAgent: navigator.userAgent,
  });
  try {
    if (navigator.sendBeacon) {
      const ok = navigator.sendBeacon(
        "/api/log",
        new Blob([body], { type: "application/json" }),
      );
      if (ok) return;
    }
    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* never throw from an error reporter */
  }
}
