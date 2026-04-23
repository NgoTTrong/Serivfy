"use client";

/**
 * No-op wrapper — content always visible, SSR-safe, no blank flashes.
 * Kept as a component so we can reintroduce scroll-reveal later via CSS
 * without touching call sites.
 */
export function Reveal({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  as?: "div" | "section" | "article";
  y?: number;
}) {
  const Tag = as;
  return <Tag className={className}>{children}</Tag>;
}
