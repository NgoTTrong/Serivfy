"use client";

import { useState } from "react";

export function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-2xl border bg-white transition ${
        open ? "border-brand-300 shadow-md shadow-brand-200/30" : "border-ink-100"
      }`}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-semibold text-ink-950">{q}</span>
        <span
          className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-ink-100 text-lg transition ${
            open ? "rotate-45 bg-brand-600 text-white" : ""
          }`}
        >
          +
        </span>
      </button>
      <div
        className="grid overflow-hidden transition-all duration-300"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0">
          <p className="px-5 pb-5 text-ink-600">{a}</p>
        </div>
      </div>
    </div>
  );
}
