"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { ReceiptPayload } from "@/lib/receipt";
import { formatVND } from "@/lib/format";

/**
 * Browser-printed thermal receipt.
 *
 * Layout strategy: a fixed-width block sized in mm (72mm inside 80mm paper,
 * or 52mm inside 58mm paper) so `@page size: 80mm auto` + "fit to page" in
 * the print dialog prints edge-to-edge on thermal rolls. Monospace font so
 * column alignment survives the printer's low DPI.
 *
 * `autoprint=1` triggers window.print() after QR render so staff only has
 * to confirm in the OS dialog.
 */
export default function ReceiptPrint({
  payload,
  vietQr,
  autoprint,
}: {
  payload: ReceiptPayload;
  vietQr: string | null;
  autoprint: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrReady, setQrReady] = useState(!vietQr);

  useEffect(() => {
    if (!vietQr) return;
    QRCode.toDataURL(vietQr, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
    })
      .then((url) => {
        setQrDataUrl(url);
        setQrReady(true);
      })
      .catch(() => setQrReady(true));
  }, [vietQr]);

  useEffect(() => {
    if (!autoprint || !qrReady) return;
    // Small delay lets layout + QR image fully paint before the OS dialog
    // freezes rendering — otherwise some printers capture a blank preview.
    const t = setTimeout(() => {
      window.print();
    }, 200);
    return () => clearTimeout(t);
  }, [autoprint, qrReady]);

  const bodyWidthMm = payload.paperWidth === 58 ? 52 : 72;
  const pageWidthMm = payload.paperWidth;
  // Map scale → base font size. Thermal printers pixelate at low sizes;
  // keep "small" above 9pt so characters stay legible at ~180 DPI.
  const baseFontPt =
    payload.template.fontScale === "small"
      ? 10
      : payload.template.fontScale === "large"
        ? 13
        : 11;

  const openedAt = new Date(payload.openedAt);
  const closedAt = new Date(payload.closedAt);

  return (
    <>
      <style jsx global>{`
        @page {
          size: ${pageWidthMm}mm auto;
          margin: 0;
        }
        html,
        body {
          margin: 0;
          padding: 0;
          background: #f4f4f5;
        }
        .receipt {
          width: ${bodyWidthMm}mm;
          margin: 16px auto;
          padding: 4mm;
          background: white;
          font-family: "Consolas", "Menlo", monospace;
          font-size: ${baseFontPt}pt;
          line-height: 1.35;
          color: #000;
        }
        .receipt .center {
          text-align: center;
        }
        .receipt .right {
          text-align: right;
        }
        .receipt hr {
          border: none;
          border-top: 1px dashed #000;
          margin: 2mm 0;
        }
        .receipt .big {
          font-size: 14pt;
          font-weight: bold;
        }
        .receipt .small {
          font-size: 9pt;
        }
        .receipt .row {
          display: flex;
          justify-content: space-between;
          gap: 4mm;
        }
        .receipt .item-name {
          flex: 1;
        }
        .receipt .opt {
          padding-left: 4mm;
          font-size: 9pt;
          color: #333;
        }
        .receipt .qr {
          margin: 2mm auto 0;
          display: block;
          max-width: 50mm;
        }
        .no-print {
          max-width: ${bodyWidthMm}mm;
          margin: 0 auto 12px;
          padding: 0 4mm;
          text-align: center;
          font-family: system-ui, sans-serif;
        }
        .no-print button {
          margin: 4px;
          padding: 8px 16px;
          border: 1px solid #ccc;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
        }
        .no-print .primary {
          background: #111;
          color: white;
          border-color: #111;
        }
        @media print {
          body {
            background: white;
          }
          .receipt {
            margin: 0;
            box-shadow: none;
          }
          .no-print {
            display: none;
          }
        }
      `}</style>

      <div className="no-print" style={{ marginTop: 16 }}>
        <button className="primary" onClick={() => window.print()}>
          🖨️ In hoá đơn
        </button>
        <button onClick={() => window.close()}>Đóng</button>
      </div>

      <div className="receipt">
        {payload.template.logoUrl && (
          <div className="center" style={{ marginBottom: "2mm" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={payload.template.logoUrl}
              alt=""
              style={{ maxWidth: "30mm", maxHeight: "20mm" }}
            />
          </div>
        )}
        <div className="center big">{payload.restaurant.name}</div>
        {payload.template.headerTagline && (
          <div className="center small">{payload.template.headerTagline}</div>
        )}
        {payload.restaurant.address && (
          <div className="center small">{payload.restaurant.address}</div>
        )}
        {payload.restaurant.phone && (
          <div className="center small">SĐT: {payload.restaurant.phone}</div>
        )}
        {payload.restaurant.taxCode && (
          <div className="center small">MST: {payload.restaurant.taxCode}</div>
        )}

        <hr />
        <div className="center" style={{ fontWeight: 600 }}>
          HOÁ ĐƠN THANH TOÁN
        </div>
        <div className="center small">#{payload.receiptNumber}</div>
        <hr />

        <div className="row small">
          <span>Bàn:</span>
          <span>{payload.tableLabel}</span>
        </div>
        <div className="row small">
          <span>Mở:</span>
          <span>{openedAt.toLocaleString("vi-VN")}</span>
        </div>
        <div className="row small">
          <span>Đóng:</span>
          <span>{closedAt.toLocaleString("vi-VN")}</span>
        </div>

        <hr />
        {payload.items.map((it, i) => (
          <div key={i} style={{ marginBottom: "1mm" }}>
            <div className="row">
              <span className="item-name">{it.name}</span>
              <span className="right small">{formatVND(it.unitPrice)}</span>
            </div>
            <div className="row small">
              <span>
                {it.qty} × {formatVND(it.unitPrice)}
              </span>
              <span>{formatVND(it.subtotal)}</span>
            </div>
            {payload.template.showItemOptions && it.optionsLabel && (
              <div className="opt">+ {it.optionsLabel}</div>
            )}
            {payload.template.showItemOptions && it.note && (
              <div className="opt">※ {it.note}</div>
            )}
          </div>
        ))}
        <hr />

        <div className="row">
          <span>Tạm tính</span>
          <span>{formatVND(payload.subtotal)}</span>
        </div>
        {payload.discount > 0 && (
          <div className="row">
            <span>Giảm giá</span>
            <span>-{formatVND(payload.discount)}</span>
          </div>
        )}
        <div className="row big">
          <span>TỔNG</span>
          <span>{formatVND(payload.total)}</span>
        </div>

        {payload.paymentMethod && (
          <>
            <hr />
            <div className="row small">
              <span>PTTT:</span>
              <span>
                {payload.paymentMethod === "CASH"
                  ? "Tiền mặt"
                  : payload.paymentMethod === "BANK_TRANSFER"
                    ? "Chuyển khoản"
                    : "Thẻ"}
              </span>
            </div>
            {payload.paidAmount != null && (
              <div className="row small">
                <span>Khách trả:</span>
                <span>{formatVND(payload.paidAmount)}</span>
              </div>
            )}
            {payload.changeAmount != null && payload.changeAmount > 0 && (
              <div className="row small">
                <span>Tiền thối:</span>
                <span>{formatVND(payload.changeAmount)}</span>
              </div>
            )}
          </>
        )}

        {vietQr && qrDataUrl && (
          <>
            <hr />
            <div className="center small">Quét QR để chuyển khoản</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="VietQR" className="qr" />
          </>
        )}

        <hr />
        <div className="center small">{payload.footer}</div>
        {payload.template.footerSecondary && (
          <div className="center small" style={{ marginTop: "1mm" }}>
            {payload.template.footerSecondary}
          </div>
        )}
      </div>
    </>
  );
}
