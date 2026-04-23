"use client";

import { useEffect, useState } from "react";

type Log = {
  id: string;
  actorType: string;
  actorId: string;
  actorName: string | null;
  action: string;
  target: string | null;
  meta: string | null;
  createdAt: string;
};

const ACTION_LABEL: Record<string, { icon: string; label: string; tone: string }> = {
  PLATFORM_LOGIN: { icon: "🔑", label: "Platform login", tone: "text-blue-300" },
  RESTAURANT_APPROVED: { icon: "✅", label: "Duyệt cửa hàng", tone: "text-green-300" },
  RESTAURANT_REJECTED: { icon: "❌", label: "Từ chối cửa hàng", tone: "text-red-300" },
  RESTAURANT_AUTO_APPROVED: { icon: "🤖", label: "Auto-approved", tone: "text-amber-300" },
  RESTAURANT_UPDATED: { icon: "✏️", label: "Cập nhật cửa hàng", tone: "text-white/80" },
  IMPERSONATE: { icon: "🎭", label: "Impersonate", tone: "text-purple-300" },
  SETTINGS_UPDATED: { icon: "⚙️", label: "Đổi cài đặt platform", tone: "text-white/80" },
};

export default function AuditClient() {
  const [logs, setLogs] = useState<Log[] | null>(null);

  useEffect(() => {
    fetch("/api/platform/audit")
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []));
  }, []);

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-display text-3xl font-bold md:text-4xl">Audit log</h1>
      <p className="mt-1 text-sm text-white/60">
        200 hành động gần nhất của đội ngũ Servify · chỉ đọc.
      </p>

      <div className="mt-6 space-y-2">
        {logs === null &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-white/5 shimmer" />
          ))}
        {logs && logs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-10 text-center text-white/60">
            Chưa có hành động nào được ghi.
          </div>
        )}
        {logs?.map((l) => {
          const cfg = ACTION_LABEL[l.action] ?? {
            icon: "•",
            label: l.action,
            tone: "text-white/70",
          };
          return (
            <div
              key={l.id}
              className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <span className="text-2xl">{cfg.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-semibold ${cfg.tone}`}>{cfg.label}</span>
                  {l.actorName && (
                    <span className="text-xs text-white/60">by {l.actorName}</span>
                  )}
                  <span className="text-xs text-white/40">
                    · {new Date(l.createdAt).toLocaleString("vi-VN")}
                  </span>
                </div>
                {l.target && (
                  <div className="mt-0.5 truncate font-mono text-xs text-white/50">
                    target: {l.target}
                  </div>
                )}
                {l.meta && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-white/50 hover:text-white">
                      Chi tiết
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-black/30 p-2 text-[10px] text-white/60">
                      {safeJson(l.meta)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function safeJson(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
