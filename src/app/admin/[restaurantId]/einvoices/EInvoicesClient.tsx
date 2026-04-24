"use client";

import { useCallback, useEffect, useState } from "react";
import { useDialog } from "@/components/DialogProvider";
import { Select } from "@/components/Select";

type Invoice = {
  id: string;
  sessionId: string;
  provider: string;
  status: string;
  invoiceNumber: string | null;
  invoiceSeries: string | null;
  pdfUrl: string | null;
  xmlUrl: string | null;
  issuedAt: string | null;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  session: {
    id: string;
    receiptNumber: string | null;
    closedAt: string | null;
    table: { label: string };
  };
};

type Config = {
  provider: string;
  apiEndpoint: string | null;
  apiUsername: string | null;
  hasPassword: boolean;
  taxCode: string | null;
  templateCode: string | null;
  seriesCode: string | null;
  isEnabled: boolean;
};

const PROVIDERS = [
  { value: "STUB", label: "STUB (chạy thử)" },
  { value: "VIETTEL", label: "Viettel SInvoice" },
  { value: "VNPT", label: "VNPT Invoice" },
  { value: "MISA", label: "MISA MeInvoice" },
  { value: "EASYINVOICE", label: "EasyInvoice" },
  { value: "HILO", label: "Hilo" },
];

export default function EInvoicesClient() {
  const dialog = useDialog();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<string>("");

  const load = useCallback(async () => {
    const q = filter ? `?status=${filter}` : "";
    const [inv, cfg] = await Promise.all([
      fetch(`/api/admin/einvoices${q}`).then((r) => r.json()),
      fetch("/api/admin/einvoices/config").then((r) => r.json()),
    ]);
    setInvoices(inv.invoices || []);
    setConfig(cfg.config);
    setLoaded(true);
  }, [filter]);
  useEffect(() => {
    load();
  }, [load]);

  async function retry(inv: Invoice) {
    const r = await fetch(`/api/admin/einvoices/${inv.sessionId}/retry`, {
      method: "POST",
    });
    if (!r.ok) {
      dialog.toast({ message: "Không xuất được HĐ", type: "error" });
      return;
    }
    dialog.toast({ message: "Đã xử lý lại", type: "success" });
    load();
  }

  return (
    <div className="p-6 md:p-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-ink-950 md:text-4xl">
          Hoá đơn điện tử
        </h1>
        <p className="text-sm text-ink-500">
          Cấu hình nhà cung cấp + theo dõi trạng thái xuất hoá đơn theo từng phiên.
        </p>
      </div>

      {/* Config */}
      <ConfigCard config={config} onSaved={load} />

      {/* Invoices list */}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Danh sách hoá đơn</h2>
          <Select
            value={filter}
            onChange={setFilter}
            options={[
              { value: "", label: "Tất cả" },
              { value: "PENDING", label: "Chờ xử lý" },
              { value: "SUBMITTED", label: "Đã gửi" },
              { value: "ISSUED", label: "Đã phát hành" },
              { value: "FAILED", label: "Lỗi" },
              { value: "REJECTED", label: "Từ chối" },
              { value: "CANCELLED", label: "Đã huỷ" },
            ]}
          />
        </div>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-ink-100 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <tr>
                <th className="px-3 py-2 text-left">Tạo</th>
                <th className="px-3 py-2 text-left">Bàn</th>
                <th className="px-3 py-2 text-left">Receipt</th>
                <th className="px-3 py-2 text-left">Provider</th>
                <th className="px-3 py-2 text-left">Trạng thái</th>
                <th className="px-3 py-2 text-left">Số HĐ</th>
                <th className="px-3 py-2 text-left">Lỗi</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {!loaded && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-ink-400">
                    Đang tải...
                  </td>
                </tr>
              )}
              {loaded && invoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-ink-400">
                    Chưa có hoá đơn nào.
                  </td>
                </tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-ink-100 align-top">
                  <td className="px-3 py-2 text-xs text-ink-500">
                    {new Date(inv.createdAt).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3 py-2">{inv.session.table.label}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {inv.session.receiptNumber ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">{inv.provider}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        inv.status === "ISSUED"
                          ? "bg-emerald-100 text-emerald-700"
                          : inv.status === "FAILED" || inv.status === "REJECTED"
                            ? "bg-red-100 text-red-700"
                            : "bg-ink-100 text-ink-700"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {inv.invoiceNumber
                      ? `${inv.invoiceSeries ?? ""}/${inv.invoiceNumber}`
                      : "—"}
                  </td>
                  <td
                    className="max-w-xs truncate px-3 py-2 text-xs text-red-600"
                    title={inv.lastError ?? ""}
                  >
                    {inv.lastError ?? ""}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {inv.status !== "ISSUED" && (
                      <button
                        onClick={() => retry(inv)}
                        className="text-xs font-semibold text-brand-600 hover:text-brand-700"
                      >
                        Xuất lại
                      </button>
                    )}
                    {inv.pdfUrl && (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-3 text-xs font-semibold text-ink-700 hover:underline"
                      >
                        PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ConfigCard({
  config,
  onSaved,
}: {
  config: Config | null;
  onSaved: () => void;
}) {
  const dialog = useDialog();
  const [provider, setProvider] = useState(config?.provider ?? "STUB");
  const [apiEndpoint, setApiEndpoint] = useState(config?.apiEndpoint ?? "");
  const [apiUsername, setApiUsername] = useState(config?.apiUsername ?? "");
  const [apiPassword, setApiPassword] = useState("");
  const [taxCode, setTaxCode] = useState(config?.taxCode ?? "");
  const [templateCode, setTemplateCode] = useState(config?.templateCode ?? "");
  const [seriesCode, setSeriesCode] = useState(config?.seriesCode ?? "");
  const [isEnabled, setIsEnabled] = useState(config?.isEnabled ?? false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!config) return;
    setProvider(config.provider);
    setApiEndpoint(config.apiEndpoint ?? "");
    setApiUsername(config.apiUsername ?? "");
    setTaxCode(config.taxCode ?? "");
    setTemplateCode(config.templateCode ?? "");
    setSeriesCode(config.seriesCode ?? "");
    setIsEnabled(config.isEnabled);
  }, [config]);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/einvoices/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          apiEndpoint: apiEndpoint || null,
          apiUsername: apiUsername || null,
          apiPassword: apiPassword || undefined,
          taxCode: taxCode || null,
          templateCode: templateCode || null,
          seriesCode: seriesCode || null,
          isEnabled,
        }),
      });
      if (!r.ok) {
        dialog.toast({ message: "Lỗi lưu cấu hình", type: "error" });
        return;
      }
      dialog.toast({ message: "Đã lưu cấu hình", type: "success" });
      setApiPassword("");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-5">
      <div className="font-display text-lg font-semibold">Cấu hình nhà cung cấp</div>
      <p className="mt-1 text-sm text-ink-500">
        Chọn nhà cung cấp HĐ điện tử. STUB dùng để chạy thử — không tạo HĐ thực tế.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="font-semibold">Provider</span>
          <Select value={provider} onChange={setProvider} options={PROVIDERS} />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">Mã số thuế</span>
          <input
            type="text"
            value={taxCode}
            onChange={(e) => setTaxCode(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">API Endpoint</span>
          <input
            type="text"
            value={apiEndpoint}
            onChange={(e) => setApiEndpoint(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono text-xs"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">Username</span>
          <input
            type="text"
            value={apiUsername}
            onChange={(e) => setApiUsername(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">
            Password {config?.hasPassword && "(đã lưu — để trống nếu không đổi)"}
          </span>
          <input
            type="password"
            value={apiPassword}
            onChange={(e) => setApiPassword(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">Mã mẫu (templateCode)</span>
          <input
            type="text"
            value={templateCode}
            onChange={(e) => setTemplateCode(e.target.value)}
            className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold">Series / Ký hiệu</span>
          <input
            type="text"
            value={seriesCode}
            onChange={(e) => setSeriesCode(e.target.value)}
            placeholder="K23TAA"
            className="mt-1 w-full rounded-xl border border-ink-200 px-3 py-2 font-mono"
          />
        </label>
      </div>
      <label className="mt-4 inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => setIsEnabled(e.target.checked)}
        />
        <span>Tự xuất HĐ khi đóng bàn</span>
      </label>
      <div className="mt-4">
        <button
          onClick={save}
          disabled={busy}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-ink-300"
        >
          {busy ? "..." : "Lưu cấu hình"}
        </button>
      </div>
    </section>
  );
}
