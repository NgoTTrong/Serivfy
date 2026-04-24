"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/Select";

type Entry = {
  id: string;
  actorName: string | null;
  action: string;
  target: string | null;
  meta: string | null;
  createdAt: string;
};

const FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "menu", label: "Thực đơn" },
  { value: "staff", label: "Nhân viên" },
  { value: "voucher", label: "Mã giảm" },
  { value: "shift", label: "Ca làm" },
  { value: "casso", label: "Casso" },
  { value: "settings", label: "Cài đặt" },
];

export default function AuditClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const q = filter ? `?action=${filter}` : "";
    fetch(`/api/admin/audit${q}`)
      .then((r) => r.json())
      .then((d) => {
        setEntries(d.entries || []);
        setLoaded(true);
      });
  }, [filter]);

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">
            Nhật ký thao tác
          </h1>
          <p className="text-sm text-ink-500">
            Ghi nhận ai đã sửa gì — dùng để truy vết thay đổi giá, xoá món,
            cấu hình Casso, v.v.
          </p>
        </div>
        <Select
          value={filter}
          onChange={setFilter}
          options={FILTERS}
          placeholder="Lọc theo nhóm"
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-3 py-2 text-left">Thời gian</th>
              <th className="px-3 py-2 text-left">Người thực hiện</th>
              <th className="px-3 py-2 text-left">Hành động</th>
              <th className="px-3 py-2 text-left">Đối tượng</th>
              <th className="px-3 py-2 text-left">Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {!loaded && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ink-400">
                  Đang tải...
                </td>
              </tr>
            )}
            {loaded && entries.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ink-400">
                  Chưa có bản ghi nào theo bộ lọc này.
                </td>
              </tr>
            )}
            {entries.map((e) => (
              <tr key={e.id} className="border-t border-ink-100 align-top">
                <td className="px-3 py-2 text-xs text-ink-500">
                  {new Date(e.createdAt).toLocaleString("vi-VN")}
                </td>
                <td className="px-3 py-2 text-xs">{e.actorName ?? "—"}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 font-mono text-[11px]">
                    {e.action}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink-500">
                  {e.target ?? ""}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-ink-600">
                  <code className="block max-w-md truncate" title={e.meta ?? ""}>
                    {e.meta ?? ""}
                  </code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
