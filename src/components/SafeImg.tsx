"use client";

import { useState } from "react";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackIcon?: string;
  fallbackClassName?: string;
};

export function SafeImg({
  src,
  alt,
  className,
  fallbackIcon = "🍽️",
  fallbackClassName,
}: Props) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div
        className={
          fallbackClassName ||
          `${className ?? ""} flex items-center justify-center bg-gradient-to-br from-brand-100 via-brand-200 to-brand-300 text-2xl`
        }
      >
        <span aria-label={alt}>{fallbackIcon}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
      loading="lazy"
    />
  );
}
