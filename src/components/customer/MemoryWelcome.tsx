"use client";

import { formatVND } from "@/lib/format";

export type MemoryProfile = {
  deviceId: string;
  nickname: string | null;
  visitCount: number;
  totalSpent: number;
  firstVisit: string;
  lastVisit: string;
  badge: "NEW" | "RETURNING" | "REGULAR" | "LOYAL" | "VIP";
  lastItems: {
    menuItemId: string;
    name: string;
    quantity: number;
    optionsLabel: string | null;
    note: string | null;
  }[];
  favorites: { id: string; name: string; image: string | null; qty: number }[];
};

const BADGE_COPY: Record<
  MemoryProfile["badge"],
  { headline: (name: string | null, n: number) => string; icon: string; grad: string }
> = {
  NEW: {
    headline: (n) => (n ? `Chào mừng ${n}!` : "Chào mừng bạn!"),
    icon: "👋",
    grad: "from-brand-100 to-brand-50",
  },
  RETURNING: {
    headline: (n, c) => `Chào ${n ?? "bạn"} trở lại — lần ${c} rồi 🎉`,
    icon: "🎉",
    grad: "from-amber-100 to-amber-50",
  },
  REGULAR: {
    headline: (n, c) => `Khách quen ${n ?? ""}! Lần thứ ${c}`,
    icon: "🔖",
    grad: "from-blue-100 to-blue-50",
  },
  LOYAL: {
    headline: (n, c) => `Cảm ơn ${n ?? "bạn"} — ${c} lần thân thương 💛`,
    icon: "💛",
    grad: "from-brand-200 to-brand-100",
  },
  VIP: {
    headline: (n, c) => `👑 ${n ?? "Khách VIP"} — người nhà quán (${c} lần)`,
    icon: "👑",
    grad: "from-amber-200 via-brand-100 to-amber-200",
  },
};

export function MemoryWelcome({
  profile,
  onReorder,
  reordering,
}: {
  profile: MemoryProfile;
  onReorder: () => void;
  reordering: boolean;
}) {
  const meta = BADGE_COPY[profile.badge];
  return (
    <div
      className={`mx-4 mt-4 rounded-3xl border border-white/60 bg-gradient-to-br ${meta.grad} p-5 shadow-sm`}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{meta.icon}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-bold leading-tight text-ink-950">
            {meta.headline(profile.nickname, profile.visitCount)}
          </h3>
          {profile.visitCount >= 2 && (
            <p className="mt-0.5 text-xs text-ink-700">
              Bạn đã ghé <strong>{profile.visitCount}</strong> lần ·{" "}
              Tổng <strong>{formatVND(profile.totalSpent)}</strong>
            </p>
          )}
        </div>
      </div>

      {profile.lastItems.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white/70 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-600">
            🔖 Lần trước bạn gọi
          </div>
          <ul className="mt-2 space-y-1 text-sm text-ink-800">
            {profile.lastItems.slice(0, 5).map((l, i) => (
              <li key={i} className="flex items-baseline justify-between gap-2">
                <span className="truncate">
                  {l.name}
                  {l.optionsLabel && (
                    <span className="text-ink-600"> · {l.optionsLabel}</span>
                  )}
                </span>
                <span className="whitespace-nowrap font-mono text-ink-600">
                  ×{l.quantity}
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={onReorder}
            disabled={reordering}
            className="mt-3 w-full rounded-xl bg-ink-950 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-ink-800 active:scale-[0.98] disabled:opacity-60"
          >
            {reordering ? "Đang thêm..." : "⚡ Gọi lại y như lần trước"}
          </button>
        </div>
      )}
    </div>
  );
}
