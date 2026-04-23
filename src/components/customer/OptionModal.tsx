"use client";

import { useMemo, useState } from "react";
import { formatVND } from "@/lib/format";
import { Spinner } from "@/components/Spinner";

export type OptionChoice = {
  id: string;
  label: string;
  priceDelta: number;
};

export type OptionGroup = {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  choices: OptionChoice[];
};

export type MenuItemForModal = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image: string | null;
  optionGroups: OptionGroup[];
};

type Props = {
  item: MenuItemForModal;
  onClose: () => void;
  onConfirm: (args: {
    choiceIds: string[];
    note: string;
    quantity: number;
  }) => void;
  submitting?: boolean;
};

export function OptionModal({ item, onClose, onConfirm, submitting = false }: Props) {
  // For single-choice groups: default to first choice (if required) or none.
  const initialSelection = useMemo(() => {
    const sel: Record<string, Set<string>> = {};
    for (const g of item.optionGroups) {
      const s = new Set<string>();
      if (!g.multiple && g.required && g.choices[0]) s.add(g.choices[0].id);
      sel[g.id] = s;
    }
    return sel;
  }, [item.optionGroups]);
  const [selection, setSelection] = useState(initialSelection);
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);

  function toggle(group: OptionGroup, choiceId: string) {
    setSelection((prev) => {
      const next = { ...prev };
      const cur = new Set(next[group.id] ?? []);
      if (group.multiple) {
        if (cur.has(choiceId)) cur.delete(choiceId);
        else cur.add(choiceId);
      } else {
        // Single: replace
        if (cur.has(choiceId) && !group.required) cur.clear();
        else {
          cur.clear();
          cur.add(choiceId);
        }
      }
      next[group.id] = cur;
      return next;
    });
  }

  const allRequiredMet = item.optionGroups.every(
    (g) => !g.required || (selection[g.id]?.size ?? 0) > 0,
  );

  const extraPrice = item.optionGroups.reduce((sum, g) => {
    const sel = selection[g.id];
    if (!sel) return sum;
    let s = 0;
    for (const cid of sel) {
      const c = g.choices.find((x) => x.id === cid);
      if (c) s += c.priceDelta;
    }
    return sum + s;
  }, 0);

  const unitPrice = item.price + extraPrice;
  const totalPrice = unitPrice * qty;

  function confirm() {
    if (!allRequiredMet) return;
    const choiceIds: string[] = [];
    for (const g of item.optionGroups) {
      const sel = selection[g.id];
      if (sel) for (const c of sel) choiceIds.push(c);
    }
    onConfirm({ choiceIds, note: note.trim(), quantity: qty });
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[95vh] w-full flex-col overflow-hidden rounded-t-3xl bg-white sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header image */}
        <div className="relative">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              className="h-40 w-full object-cover"
            />
          ) : (
            <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-brand-100 to-brand-300 text-5xl">
              🍽️
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="Đóng"
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink-950/80 text-white backdrop-blur hover:bg-ink-950"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 pb-4 pt-4">
          <h2 className="font-display text-2xl font-bold text-ink-950">{item.name}</h2>
          {item.description && (
            <p className="mt-1 text-sm text-ink-500">{item.description}</p>
          )}
          <div className="mt-2 font-bold text-brand-700">{formatVND(item.price)}</div>

          <div className="mt-5 space-y-5">
            {item.optionGroups.map((g) => (
              <div key={g.id}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-ink-950">
                    {g.name}
                    {g.required && (
                      <span className="ml-1.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        Bắt buộc
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-ink-500">
                    {g.multiple ? "Chọn nhiều" : "Chọn 1"}
                  </span>
                </div>
                <div className="mt-2 space-y-2">
                  {g.choices.map((c) => {
                    const selected = selection[g.id]?.has(c.id) ?? false;
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggle(g, c.id)}
                        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                          selected
                            ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200"
                            : "border-ink-200 bg-white hover:border-ink-300"
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <span
                            className={`inline-flex h-5 w-5 flex-none items-center justify-center ${
                              g.multiple ? "rounded" : "rounded-full"
                            } border-2 ${
                              selected
                                ? "border-brand-600 bg-brand-600 text-white"
                                : "border-ink-300"
                            }`}
                          >
                            {selected && (g.multiple ? "✓" : "●")}
                          </span>
                          <span className="font-medium text-ink-900">{c.label}</span>
                        </span>
                        {c.priceDelta !== 0 && (
                          <span className="text-sm font-semibold text-brand-700">
                            {c.priceDelta > 0 ? "+" : ""}
                            {formatVND(c.priceDelta)}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <div className="font-semibold text-ink-950">Ghi chú</div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Không hành, ít cay, ít đá..."
                className="mt-2 w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                maxLength={200}
              />
            </div>
          </div>
        </div>

        {/* Sticky bottom CTA */}
        <div className="border-t border-ink-100 bg-white px-5 pt-4 pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-ink-200 bg-white text-xl font-bold hover:bg-ink-50"
              >
                −
              </button>
              <span className="min-w-[2rem] text-center font-display text-xl font-bold">
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => Math.min(50, q + 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white hover:bg-brand-700"
              >
                +
              </button>
            </div>
            <button
              onClick={confirm}
              disabled={!allRequiredMet || submitting}
              className="ml-3 flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 font-bold text-white shadow-lg shadow-brand-600/30 transition hover:bg-brand-700 disabled:bg-ink-300 disabled:shadow-none"
            >
              {submitting && <Spinner className="h-4 w-4" />}
              {submitting
                ? "Đang thêm..."
                : allRequiredMet
                  ? `Thêm ${qty > 1 ? qty + " món — " : ""}${formatVND(totalPrice)}`
                  : "Chọn đủ các mục bắt buộc"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
