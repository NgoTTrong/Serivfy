"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function StickyHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 20);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all ${
        scrolled
          ? "border-b border-ink-100 bg-white/85 shadow-sm backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 md:px-12">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md shadow-brand-600/40 transition hover:scale-110">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zM14 3h7v7h-7V3zm0 13h3v3h-3v-3zm4 0h3v3h-3v-3zm0 4h3v1h-3v-1z" />
            </svg>
          </span>
          <span className="font-display text-2xl font-bold tracking-tight text-ink-950">
            Servify
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-ink-700 md:flex">
          <a href="#features" className="hover:text-brand-600">Tính năng</a>
          <a href="#how" className="hover:text-brand-600">Cách dùng</a>
          <a href="#pricing" className="hover:text-brand-600">Bảng giá</a>
          <a href="#faq" className="hover:text-brand-600">FAQ</a>
          <Link href="/admin/login" className="hover:text-brand-600">
            Đăng nhập
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-brand-600 px-5 py-2 font-semibold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700"
          >
            Dùng thử miễn phí
          </Link>
        </nav>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-ink-100 md:hidden"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>
      {open && (
        <div className="border-t border-ink-100 bg-white px-6 py-3 md:hidden">
          <nav className="flex flex-col gap-2 text-sm">
            <a onClick={() => setOpen(false)} href="#features" className="rounded-lg px-3 py-2 hover:bg-brand-50">Tính năng</a>
            <a onClick={() => setOpen(false)} href="#how" className="rounded-lg px-3 py-2 hover:bg-brand-50">Cách dùng</a>
            <a onClick={() => setOpen(false)} href="#pricing" className="rounded-lg px-3 py-2 hover:bg-brand-50">Bảng giá</a>
            <a onClick={() => setOpen(false)} href="#faq" className="rounded-lg px-3 py-2 hover:bg-brand-50">FAQ</a>
            <Link onClick={() => setOpen(false)} href="/admin/login" className="rounded-lg px-3 py-2 hover:bg-brand-50">Đăng nhập</Link>
            <Link onClick={() => setOpen(false)} href="/signup" className="rounded-full bg-brand-600 px-5 py-2 text-center font-semibold text-white">Dùng thử miễn phí</Link>
          </nav>
        </div>
      )}
    </header>
  );
}
