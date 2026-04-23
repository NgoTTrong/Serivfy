"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PlanInfo = {
  planTier: "TRIAL" | "STARTER" | "PRO" | "ENTERPRISE";
  trialEndsAt: string | null;
  daysLeft: number | null;
};

export function TrialBanner({
  restaurantId,
  planInfo,
}: {
  restaurantId: string;
  planInfo: PlanInfo;
}) {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    // session-scoped dismiss
    setDismissed(sessionStorage.getItem(`trial_dismiss_${restaurantId}`) === "1");
  }, [restaurantId]);

  if (planInfo.planTier !== "TRIAL") return null;
  if (planInfo.daysLeft === null) return null;
  if (dismissed) return null;

  const critical = planInfo.daysLeft <= 3;

  return (
    <div
      className={`relative z-[55] flex items-center justify-between gap-3 px-4 py-2 text-xs sm:text-sm ${
        critical
          ? "bg-red-600 text-white"
          : "bg-amber-400 text-ink-950"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{critical ? "⚠️" : "🎁"}</span>
        {planInfo.daysLeft <= 0 ? (
          <span>Bản dùng thử đã hết — một số tính năng bị khoá.</span>
        ) : (
          <span>
            Còn <strong>{planInfo.daysLeft} ngày</strong> dùng thử
            {critical ? " — nâng cấp để không gián đoạn." : "."}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/${restaurantId}/billing`}
          className={`whitespace-nowrap rounded-full px-3 py-1 font-bold ${
            critical
              ? "bg-white text-red-700 hover:bg-ink-100"
              : "bg-ink-950 text-white hover:bg-ink-800"
          }`}
        >
          Nâng cấp →
        </Link>
        <button
          onClick={() => {
            sessionStorage.setItem(`trial_dismiss_${restaurantId}`, "1");
            setDismissed(true);
          }}
          className="rounded-full px-2 text-current opacity-70 hover:opacity-100"
          aria-label="Đóng"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
