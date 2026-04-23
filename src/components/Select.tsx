"use client";

import { useEffect, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  sub?: string;
  icon?: string;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
};

export function Select({
  value,
  onChange,
  options,
  placeholder = "Chọn...",
  disabled = false,
  className,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        btnRef.current?.contains(e.target as Node) ||
        listRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => Math.min(options.length - 1, h + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
      } else if (e.key === "Enter" && highlight >= 0) {
        e.preventDefault();
        onChange(options[highlight].value);
        setOpen(false);
        btnRef.current?.focus();
      }
    }
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, highlight, options, onChange]);

  useEffect(() => {
    if (open && selected) {
      setHighlight(options.findIndex((o) => o.value === selected.value));
    }
  }, [open, selected, options]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!open || highlight < 0 || !listRef.current) return;
    const el = listRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        ref={btnRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border bg-white px-4 py-3 text-left text-sm outline-none transition ${
          open
            ? "border-brand-500 ring-2 ring-brand-200"
            : "border-ink-200 hover:border-ink-300 focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-200"
        } ${disabled ? "cursor-not-allowed bg-ink-50 text-ink-400" : ""}`}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">
          {selected?.icon && <span className="text-base">{selected.icon}</span>}
          {selected ? (
            <span className="truncate font-medium text-ink-900">{selected.label}</span>
          ) : (
            <span className="truncate text-ink-400">{placeholder}</span>
          )}
        </span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className={`h-4 w-4 flex-none text-ink-500 transition ${open ? "rotate-180" : ""}`}
        >
          <path fill="currentColor" d="M5.5 7.5L10 12l4.5-4.5-1-1L10 10 6.5 6.5z" />
        </svg>
      </button>

      {open && (
        <>
          <ul
            ref={listRef}
            role="listbox"
            className="animate-fade-up absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-auto rounded-xl border border-ink-200 bg-white p-1 shadow-2xl shadow-ink-950/15"
          >
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink-400">Không có lựa chọn</li>
            )}
            {options.map((opt, i) => {
              const active = i === highlight;
              const isSelected = opt.value === value;
              return (
                <li
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlight(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(opt.value);
                    setOpen(false);
                    btnRef.current?.focus();
                  }}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${
                    active
                      ? "bg-brand-50 text-brand-900"
                      : "text-ink-800 hover:bg-ink-50"
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {opt.icon && <span className="text-base">{opt.icon}</span>}
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{opt.label}</span>
                      {opt.sub && (
                        <span className="truncate text-[11px] text-ink-500">
                          {opt.sub}
                        </span>
                      )}
                    </span>
                  </span>
                  {isSelected && (
                    <span className="flex-none font-bold text-brand-600">✓</span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
