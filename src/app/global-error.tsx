"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/client-log";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      event: "browser.global-error",
      severity: "critical",
      message: error.message || "Unknown global error",
      stack: error.stack,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <h1>Hệ thống gặp sự cố</h1>
          <p>Vui lòng thử lại sau. Liên hệ hi@servify.vn nếu vấn đề tiếp diễn.</p>
          {error.digest ? (
            <p>
              Mã lỗi: <code>{error.digest}</code>
            </p>
          ) : null}
          <button onClick={reset}>Thử lại</button>
        </main>
      </body>
    </html>
  );
}
