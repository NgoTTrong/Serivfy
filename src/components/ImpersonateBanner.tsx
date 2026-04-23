"use client";

import { useEffect, useState } from "react";

/**
 * Banner shown at the top of admin pages when a platform admin has impersonated
 * into a restaurant. Client reads cookie `servify_impersonating` set by
 * /api/platform/restaurants/[id]/impersonate.
 */
export function ImpersonateBanner() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(document.cookie.includes("servify_impersonating=1"));
  }, []);

  async function exit() {
    await fetch("/api/auth/logout", { method: "POST" });
    // clear marker cookie
    document.cookie = "servify_impersonating=; Max-Age=0; path=/";
    window.location.href = "/superadmin/restaurants";
  }

  if (!active) return null;

  return (
    <div className="relative z-[60] flex items-center justify-between gap-3 bg-purple-600 px-4 py-2 text-xs text-white sm:text-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎭</span>
        <span>
          Bạn đang đóng vai <strong>Admin cửa hàng</strong> — mọi thao tác được ghi vào audit log.
        </span>
      </div>
      <button
        onClick={exit}
        className="whitespace-nowrap rounded-full bg-white/20 px-3 py-1 font-semibold hover:bg-white/30"
      >
        Quay về HQ
      </button>
    </div>
  );
}
