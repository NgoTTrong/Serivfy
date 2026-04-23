"use client";

import { useEffect, useState } from "react";
import { useDialog } from "@/components/DialogProvider";

export default function SettingsClient() {
  const dialog = useDialog();
  const [autoApprove, setAutoApprove] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/platform/settings");
    if (r.ok) {
      const d = await r.json();
      setAutoApprove(d.settings.autoApprove);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function toggle() {
    if (autoApprove === null) return;
    const next = !autoApprove;
    setBusy(true);
    const r = await fetch("/api/platform/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoApprove: next }),
    });
    setBusy(false);
    if (r.ok) {
      setAutoApprove(next);
      dialog.toast({
        message: next ? "Bật auto-approve" : "Tắt auto-approve",
        type: "success",
      });
    }
  }

  return (
    <div className="p-6 md:p-10">
      <h1 className="font-display text-3xl font-bold md:text-4xl">Platform settings</h1>
      <p className="mt-1 text-sm text-white/60">
        Cấu hình hành vi chung của hệ thống Servify.
      </p>

      <div className="mt-8 max-w-2xl space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold">Tự động duyệt đăng ký</h2>
              <p className="mt-1 text-sm text-white/60">
                Khi bật, mọi yêu cầu mở tài khoản mới sẽ được kích hoạt ngay không cần chờ
                duyệt thủ công. Phù hợp khi chạy đợt marketing cần thu khách nhanh.
              </p>
              <p className="mt-2 text-xs text-amber-300">
                ⚠️ Khi tắt, các yêu cầu mới sẽ ở trạng thái <span className="font-mono">PENDING</span> cho đến khi bạn duyệt.
              </p>
            </div>
            <div className="flex-none">
              {autoApprove === null ? (
                <div className="h-8 w-14 rounded-full bg-white/10 shimmer" />
              ) : (
                <Toggle value={autoApprove} onChange={toggle} disabled={busy} />
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="font-display text-xl font-bold">Plan Servify</h2>
          <p className="mt-1 text-sm text-white/60">Tóm tắt giá & giới hạn (read-only).</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-[10px] uppercase tracking-widest text-white/50">
                <tr>
                  <th className="px-4 py-2 text-left">Gói</th>
                  <th className="px-4 py-2 text-right">Giá/tháng</th>
                  <th className="px-4 py-2 text-right">Bàn</th>
                  <th className="px-4 py-2 text-right">NV (ngoài admin)</th>
                </tr>
              </thead>
              <tbody className="text-white/80">
                {[
                  ["🎁 Trial", "0đ (14 ngày)", "3", "2"],
                  ["🌱 Starter", "199,000đ", "15", "5"],
                  ["⭐ Pro", "499,000đ", "50", "∞"],
                  ["🏢 Enterprise", "Liên hệ", "∞", "∞"],
                ].map((row, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-4 py-2 font-medium">{row[0]}</td>
                    <td className="px-4 py-2 text-right">{row[1]}</td>
                    <td className="px-4 py-2 text-right font-mono">{row[2]}</td>
                    <td className="px-4 py-2 text-right font-mono">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      role="switch"
      aria-checked={value}
      className={`relative h-8 w-14 rounded-full transition ${
        value ? "bg-brand-600" : "bg-white/20"
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-1 left-1 inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-6" : "translate-x-0"
        }`}
      />
    </button>
  );
}
