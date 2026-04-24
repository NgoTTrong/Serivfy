"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-log";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      event: "browser.route-error",
      severity: "critical",
      message: error.message || "Unknown error",
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="max-w-md">
        <div className="text-5xl">⚠️</div>
        <h1 className="mt-4 font-display text-2xl font-bold">Có lỗi xảy ra</h1>
        <p className="mt-2 text-ink-600">
          Hệ thống gặp sự cố. Vui lòng thử lại. Nếu tiếp diễn, liên hệ{" "}
          <a href="mailto:hi@servify.vn" className="underline">
            hi@servify.vn
          </a>
          .
        </p>
        {error.digest ? (
          <p className="mt-2 font-mono text-xs text-ink-400">
            Mã lỗi: {error.digest}
          </p>
        ) : null}
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-brand-500 px-6 py-2 text-white hover:bg-brand-600"
        >
          Thử lại
        </button>
      </div>
    </main>
  );
}
