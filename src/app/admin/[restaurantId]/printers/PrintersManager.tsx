"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDialog } from "@/components/DialogProvider";
import { Select } from "@/components/Select";

type Agent = {
  id: string;
  name: string;
  branchId: string | null;
  version: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  revokedAt: string | null;
  _count: { printers: number };
};

type PrinterRow = {
  id: string;
  agentId: string;
  name: string;
  kind: "RECEIPT" | "KITCHEN" | "BAR" | "LABEL";
  paperWidth: number;
  usbVendorId: number | null;
  usbProductId: number | null;
  networkHost: string | null;
  networkPort: number | null;
  bluetoothAddr: string | null;
  isActive: boolean;
  lastSeenAt: string | null;
  agent: { id: string; name: string; lastSeenAt: string | null };
};

type Pairing = {
  pairingId: string;
  code: string;
  expiresAt: string;
  downloadUrl: string;
};

type Station = {
  id: string;
  name: string;
  order: number;
  printerId: string | null;
  printer: { id: string; name: string; kind: string } | null;
  _count: { menuItems: number };
};

type JobRow = {
  id: string;
  kind: string;
  status: "QUEUED" | "DISPATCHED" | "DONE" | "FAILED";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  processedAt: string | null;
  printer: { id: string; name: string; kind: string };
};

const OFFLINE_THRESHOLD_MS = 2 * 60_000;

function isOnline(ts: string | null): boolean {
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < OFFLINE_THRESHOLD_MS;
}

function formatAge(ts: string | null): string {
  if (!ts) return "chưa kết nối";
  const ms = Date.now() - new Date(ts).getTime();
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s trước`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}p trước`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h trước`;
  return `${Math.round(ms / 86_400_000)}d trước`;
}

const KIND_LABEL: Record<PrinterRow["kind"], string> = {
  RECEIPT: "Thu ngân",
  KITCHEN: "Bếp",
  BAR: "Bar",
  LABEL: "Nhãn",
};

export default function PrintersManager() {
  const dialog = useDialog();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [printers, setPrinters] = useState<PrinterRow[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [pairingName, setPairingName] = useState("Máy quầy chính");
  const [pairBusy, setPairBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [newStationName, setNewStationName] = useState("");
  const [stationBusy, setStationBusy] = useState(false);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [jobFilter, setJobFilter] = useState<"" | JobRow["status"]>("FAILED");

  const load = useCallback(async () => {
    const [a, b, s] = await Promise.all([
      fetch("/api/admin/print/agents").then((r) => r.json()),
      fetch("/api/admin/print/printers").then((r) => r.json()),
      fetch("/api/admin/stations").then((r) => r.json()),
    ]);
    setAgents(a.agents || []);
    setPrinters(b.printers || []);
    setStations(s.stations || []);
    setLoaded(true);
  }, []);

  const loadJobs = useCallback(async () => {
    const q = jobFilter ? `?status=${jobFilter}` : "";
    const r = await fetch(`/api/admin/print/jobs${q}`);
    if (r.ok) setJobs((await r.json()).jobs || []);
  }, [jobFilter]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    const tick = setInterval(() => setNow(Date.now()), 5_000);
    return () => {
      clearInterval(iv);
      clearInterval(tick);
    };
  }, [load]);

  useEffect(() => {
    loadJobs();
    const iv = setInterval(loadJobs, 10_000);
    return () => clearInterval(iv);
  }, [loadJobs]);

  async function retryJob(j: JobRow) {
    await fetch(`/api/admin/print/jobs/${j.id}/retry`, { method: "POST" });
    dialog.toast({ message: "Đã đưa lại vào hàng đợi", type: "success" });
    loadJobs();
  }

  const pairingCountdown = useMemo(() => {
    if (!pairing) return 0;
    return Math.max(0, new Date(pairing.expiresAt).getTime() - now);
  }, [pairing, now]);

  useEffect(() => {
    if (pairing && pairingCountdown === 0) setPairing(null);
  }, [pairing, pairingCountdown]);

  async function startPair() {
    if (pairBusy) return;
    const name = pairingName.trim();
    if (!name) return;
    setPairBusy(true);
    try {
      const r = await fetch("/api/admin/print/agents/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: name }),
      });
      if (!r.ok) {
        dialog.toast({ message: "Không tạo được mã ghép", type: "error" });
        return;
      }
      const d = await r.json();
      setPairing(d);
    } finally {
      setPairBusy(false);
    }
  }

  async function revokeAgent(agent: Agent) {
    const ok = await dialog.confirm({
      icon: "⚠️",
      title: `Thu hồi ${agent.name}?`,
      message:
        "Máy quầy này sẽ không in được nữa. Các máy in trực thuộc sẽ dừng hoạt động.",
      confirmLabel: "Thu hồi",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/print/agents/${agent.id}/revoke`, { method: "POST" });
    dialog.toast({ message: "Đã thu hồi", type: "success" });
    load();
  }

  async function togglePrinter(p: PrinterRow) {
    await fetch(`/api/admin/print/printers/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    load();
  }

  async function addStation() {
    const name = newStationName.trim();
    if (!name || stationBusy) return;
    setStationBusy(true);
    try {
      const r = await fetch("/api/admin/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!r.ok) {
        dialog.toast({ message: "Không tạo được station", type: "error" });
        return;
      }
      setNewStationName("");
      load();
    } finally {
      setStationBusy(false);
    }
  }

  async function assignStationPrinter(station: Station, printerId: string | null) {
    await fetch(`/api/admin/stations/${station.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ printerId }),
    });
    load();
  }

  async function deleteStation(station: Station) {
    const hasItems = station._count.menuItems > 0;
    const ok = await dialog.confirm({
      icon: "🗑️",
      title: `Xoá station "${station.name}"?`,
      message: hasItems
        ? `${station._count.menuItems} món đang gắn station này — các món sẽ thôi in bếp cho đến khi gán station khác.`
        : "Xoá station này?",
      confirmLabel: "Xoá",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/stations/${station.id}`, { method: "DELETE" });
    dialog.toast({ message: "Đã xoá station", type: "success" });
    load();
  }

  async function deletePrinter(p: PrinterRow) {
    const ok = await dialog.confirm({
      icon: "🗑️",
      title: `Xoá ${p.name}?`,
      message: "Các station đang gắn máy in này sẽ ngừng in.",
      confirmLabel: "Xoá",
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/admin/print/printers/${p.id}`, { method: "DELETE" });
    dialog.toast({ message: `Đã xoá ${p.name}`, type: "success" });
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">Máy in</h1>
          <p className="text-sm text-ink-500">
            Ghép máy quầy + cấu hình máy in bếp / thu ngân.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="font-semibold">💡 Mặc định: in hoá đơn qua trình duyệt</div>
        <p className="mt-1">
          Khi đóng bàn, Servify mở tab mới in hoá đơn 80mm qua máy in cắm
          trực tiếp máy quầy. Chọn máy in nhiệt K80 trong hộp thoại OS →
          "Lưu mặc định" lần đầu là xong.
        </p>
        <p className="mt-1">
          <strong>Print Agent</strong> (tự in bếp + nhiều máy in cùng lúc, không cần
          click): <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold">
            Sắp ra mắt
          </span>. Các cấu hình bên dưới sẽ hoạt động khi Agent phát hành.
        </p>
      </div>

      {/* Agents */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Máy quầy</h2>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {!loaded &&
            Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-2xl border border-ink-100 bg-white shimmer"
              />
            ))}
          {loaded && agents.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-ink-200 p-8 text-center text-ink-500">
              Chưa có máy quầy nào — bấm “Ghép máy quầy mới” bên dưới.
            </div>
          )}
          {loaded &&
            agents.map((a) => {
              const online = !a.revokedAt && isOnline(a.lastSeenAt);
              return (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-ink-100 bg-white p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2.5 w-2.5 rounded-full ${
                          a.revokedAt
                            ? "bg-ink-300"
                            : online
                              ? "bg-emerald-500"
                              : "bg-red-500"
                        }`}
                      />
                      <span className="font-semibold">{a.name}</span>
                      {a.revokedAt && (
                        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
                          đã thu hồi
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-ink-500">
                      {a.revokedAt
                        ? "Đã vô hiệu hoá"
                        : online
                          ? `Online · ${formatAge(a.lastSeenAt)}`
                          : `Offline · ${formatAge(a.lastSeenAt)}`}
                      {a.version ? ` · v${a.version}` : ""}
                      {` · ${a._count.printers} máy in`}
                    </div>
                  </div>
                  {!a.revokedAt && (
                    <button
                      onClick={() => revokeAgent(a)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700"
                    >
                      Thu hồi
                    </button>
                  )}
                </div>
              );
            })}
        </div>

        {/* Pair new agent */}
        <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/40 p-4">
          <div className="font-semibold text-brand-800">Ghép máy quầy mới</div>
          <p className="mt-1 text-sm text-ink-600">
            Tải Print Agent về máy tính quán → mở app → nhập mã 6 số bên dưới.
          </p>
          {pairing ? (
            <div className="mt-3 rounded-xl border border-brand-300 bg-white p-4">
              <div className="text-xs uppercase tracking-wide text-ink-500">Mã ghép</div>
              <div className="mt-1 font-mono text-4xl font-bold tracking-widest text-brand-700">
                {pairing.code}
              </div>
              <div className="mt-2 text-xs text-ink-500">
                Hết hạn sau {Math.ceil(pairingCountdown / 1000)}s · 1 lần dùng
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={pairing.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-ink-950 px-4 py-2 text-xs font-semibold text-white hover:bg-ink-800"
                >
                  Tải Print Agent (Windows)
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(pairing.code).catch(() => undefined);
                    dialog.toast({ message: "Đã copy mã", type: "success" });
                  }}
                  className="rounded-full border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                >
                  Copy mã
                </button>
                <button
                  onClick={() => setPairing(null)}
                  className="text-xs font-semibold text-ink-500 hover:text-ink-700"
                >
                  Huỷ
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={pairingName}
                onChange={(e) => setPairingName(e.target.value)}
                placeholder="Tên máy quầy (VD: Quầy chính)"
                className="flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm focus:border-brand-400 focus:outline-none"
              />
              <button
                onClick={startPair}
                disabled={pairBusy || !pairingName.trim()}
                className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-300"
              >
                {pairBusy ? "..." : "Tạo mã ghép"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Printers */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Máy in</h2>
          <button
            onClick={() => setShowAddPrinter(true)}
            disabled={agents.filter((a) => !a.revokedAt).length === 0}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-ink-300"
          >
            + Thêm máy in
          </button>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {loaded && printers.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-ink-200 p-8 text-center text-ink-500">
              Chưa có máy in nào. Cấu hình sau khi ghép máy quầy.
            </div>
          )}
          {printers.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border bg-white p-4 ${
                p.isActive ? "border-ink-100" : "border-red-200 bg-red-50/30"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">
                    {p.name}{" "}
                    <span className="ml-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
                      {KIND_LABEL[p.kind]}
                    </span>
                    <span className="ml-1 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-600">
                      {p.paperWidth}mm
                    </span>
                    {!p.isActive && (
                      <span className="ml-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                        tạm tắt
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-ink-500">
                    Máy quầy: {p.agent.name}
                  </div>
                  <div className="mt-1 font-mono text-xs text-ink-500">
                    {p.networkHost
                      ? `${p.networkHost}:${p.networkPort ?? 9100}`
                      : p.usbVendorId
                        ? `USB ${p.usbVendorId.toString(16).padStart(4, "0")}:${(p.usbProductId ?? 0).toString(16).padStart(4, "0")}`
                        : p.bluetoothAddr
                          ? `BT ${p.bluetoothAddr}`
                          : "chưa cấu hình"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => togglePrinter(p)}
                    className="text-xs font-semibold text-ink-600 hover:text-ink-800"
                  >
                    {p.isActive ? "Tạm tắt" : "Bật lại"}
                  </button>
                  <button
                    onClick={() => deletePrinter(p)}
                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                  >
                    Xoá
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Stations */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Station (bếp / bar)</h2>
        </div>
        <p className="mt-1 text-sm text-ink-500">
          Station là nơi món được chế biến. Mỗi station gắn 1 máy in để in
          ticket khi có đơn. Chỉ định station cho từng món ở trang Thực đơn.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {loaded && stations.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-ink-200 p-6 text-center text-ink-500">
              Chưa có station. Tạo station đầu tiên (VD: “Bếp nóng”, “Bar”).
            </div>
          )}
          {stations.map((s) => (
            <div key={s.id} className="rounded-2xl border border-ink-100 bg-white p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="mt-0.5 text-xs text-ink-500">
                    {s._count.menuItems} món
                  </div>
                </div>
                <button
                  onClick={() => deleteStation(s)}
                  className="text-xs font-semibold text-red-600 hover:text-red-700"
                >
                  Xoá
                </button>
              </div>
              <div className="mt-3">
                <label className="text-xs text-ink-500">Máy in</label>
                <Select
                  value={s.printerId ?? ""}
                  onChange={(v) => assignStationPrinter(s, v || null)}
                  options={[
                    { value: "", label: "— chưa gán —" },
                    ...printers
                      .filter((p) => p.isActive && p.kind !== "RECEIPT")
                      .map((p) => ({
                        value: p.id,
                        label: `${p.name} (${KIND_LABEL[p.kind]})`,
                      })),
                  ]}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <input
            type="text"
            value={newStationName}
            onChange={(e) => setNewStationName(e.target.value)}
            placeholder="Tên station mới (VD: Bếp nóng)"
            className="flex-1 rounded-xl border border-ink-200 bg-white px-4 py-2 text-sm"
          />
          <button
            onClick={addStation}
            disabled={stationBusy || !newStationName.trim()}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-ink-300"
          >
            + Thêm
          </button>
        </div>
      </section>

      {/* Jobs log */}
      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Lịch sử in</h2>
          <Select
            value={jobFilter}
            onChange={(v) => setJobFilter(v as "" | JobRow["status"])}
            options={[
              { value: "FAILED", label: "Lỗi" },
              { value: "QUEUED", label: "Đang chờ" },
              { value: "DISPATCHED", label: "Đang in" },
              { value: "DONE", label: "Hoàn tất" },
              { value: "", label: "Tất cả" },
            ]}
          />
        </div>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2 text-left">Thời gian</th>
                <th className="px-3 py-2 text-left">Loại</th>
                <th className="px-3 py-2 text-left">Máy in</th>
                <th className="px-3 py-2 text-left">Trạng thái</th>
                <th className="px-3 py-2 text-left">Lần thử</th>
                <th className="px-3 py-2 text-left">Lỗi</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-ink-400">
                    Không có job {jobFilter ? "theo bộ lọc này" : ""}.
                  </td>
                </tr>
              )}
              {jobs.map((j) => (
                <tr key={j.id} className="border-t border-ink-100">
                  <td className="px-3 py-2 text-xs text-ink-500">
                    {new Date(j.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3 py-2">{j.kind}</td>
                  <td className="px-3 py-2">{j.printer.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        j.status === "DONE"
                          ? "bg-emerald-100 text-emerald-700"
                          : j.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : j.status === "DISPATCHED"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-ink-100 text-ink-700"
                      }`}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{j.attempts}</td>
                  <td
                    className="max-w-xs truncate px-3 py-2 text-xs text-red-600"
                    title={j.lastError ?? ""}
                  >
                    {j.lastError}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {j.status !== "DONE" && (
                      <button
                        onClick={() => retryJob(j)}
                        className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                      >
                        In lại
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showAddPrinter && (
        <AddPrinterModal
          agents={agents.filter((a) => !a.revokedAt)}
          onClose={() => setShowAddPrinter(false)}
          onCreated={() => {
            setShowAddPrinter(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddPrinterModal({
  agents,
  onClose,
  onCreated,
}: {
  agents: Agent[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const dialog = useDialog();
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const [name, setName] = useState("");
  const [kind, setKind] = useState<PrinterRow["kind"]>("KITCHEN");
  const [paperWidth, setPaperWidth] = useState<58 | 80>(80);
  const [connType, setConnType] = useState<"usb" | "network">("network");
  const [networkHost, setNetworkHost] = useState("");
  const [networkPort, setNetworkPort] = useState<number>(9100);
  const [usbVendorHex, setUsbVendorHex] = useState("");
  const [usbProductHex, setUsbProductHex] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        agentId,
        name: name.trim(),
        kind,
        paperWidth,
      };
      if (connType === "network") {
        if (!networkHost.trim()) {
          dialog.toast({ message: "Nhập IP máy in", type: "error" });
          return;
        }
        body.networkHost = networkHost.trim();
        body.networkPort = networkPort;
      } else {
        const v = parseInt(usbVendorHex, 16);
        const p = parseInt(usbProductHex, 16);
        if (Number.isNaN(v) || Number.isNaN(p)) {
          dialog.toast({ message: "VendorID / ProductID không hợp lệ", type: "error" });
          return;
        }
        body.usbVendorId = v;
        body.usbProductId = p;
      }
      const r = await fetch("/api/admin/print/printers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        dialog.toast({ message: `Lỗi: ${d.error ?? r.status}`, type: "error" });
        return;
      }
      dialog.toast({ message: "Đã thêm máy in", type: "success" });
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <h3 className="font-display text-xl font-bold">Thêm máy in</h3>
        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-semibold">Máy quầy</span>
            <Select
              value={agentId}
              onChange={setAgentId}
              options={agents.map((a) => ({ value: a.id, label: a.name }))}
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">Tên máy in</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Bếp nóng"
              className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="font-semibold">Loại</span>
              <Select
                value={kind}
                onChange={(v) => setKind(v as PrinterRow["kind"])}
                options={[
                  { value: "RECEIPT", label: "Thu ngân" },
                  { value: "KITCHEN", label: "Bếp" },
                  { value: "BAR", label: "Bar" },
                  { value: "LABEL", label: "Nhãn" },
                ]}
              />
            </label>
            <label className="block text-sm">
              <span className="font-semibold">Khổ giấy</span>
              <Select
                value={String(paperWidth)}
                onChange={(v) => setPaperWidth(v === "58" ? 58 : 80)}
                options={[
                  { value: "80", label: "80mm (K80)" },
                  { value: "58", label: "58mm (K58)" },
                ]}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-semibold">Kết nối</span>
            <Select
              value={connType}
              onChange={(v) => setConnType(v as "usb" | "network")}
              options={[
                { value: "network", label: "Mạng LAN (TCP/IP)" },
                { value: "usb", label: "USB" },
              ]}
            />
          </label>
          {connType === "network" ? (
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-2 block text-sm">
                <span className="font-semibold">IP máy in</span>
                <input
                  type="text"
                  value={networkHost}
                  onChange={(e) => setNetworkHost(e.target.value)}
                  placeholder="192.168.1.50"
                  className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold">Port</span>
                <input
                  type="number"
                  value={networkPort}
                  onChange={(e) => setNetworkPort(parseInt(e.target.value, 10) || 9100)}
                  className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
                />
              </label>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-sm">
                <span className="font-semibold">Vendor ID (hex)</span>
                <input
                  type="text"
                  value={usbVendorHex}
                  onChange={(e) => setUsbVendorHex(e.target.value)}
                  placeholder="0416"
                  className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold">Product ID (hex)</span>
                <input
                  type="text"
                  value={usbProductHex}
                  onChange={(e) => setUsbProductHex(e.target.value)}
                  placeholder="5011"
                  className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
                />
              </label>
            </div>
          )}
          <p className="rounded-xl bg-ink-50 p-3 text-xs text-ink-600">
            💡 Khi Print Agent chạy trên máy quầy, nó sẽ quét USB tự động và
            hiển thị VendorID / ProductID ngay trong app. Bạn copy vào đây.
          </p>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-50"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={busy || !name.trim() || !agentId}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-ink-300"
          >
            {busy ? "..." : "Thêm"}
          </button>
        </div>
      </form>
    </div>
  );
}
