"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counter that animates 0 → `to` when scrolled into view.
 * If element is already on-screen when component mounts (above the fold),
 * it shows the final value immediately — no number-flip flash.
 */
export function Counter({
  to,
  suffix = "",
  prefix = "",
  duration = 1800,
  format = "int",
}: {
  to: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  format?: "int" | "comma";
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(to);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    // Already visible → keep final value, skip animation
    if (rect.top < vh * 0.95) {
      setValue(to);
      return;
    }
    // Below fold → reset to 0 and animate on scroll-in
    setValue(0);
    const animate = () => {
      if (started.current) return;
      started.current = true;
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(to * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            animate();
            io.disconnect();
          }
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  const display = format === "comma" ? value.toLocaleString("en-US") : String(value);
  return (
    <span ref={ref}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
