"use client";

import { useMousePosition } from "@/hooks/useMousePosition";
import { useEffect, useState } from "react";

export function MouseLight() {
  const { x, y } = useMousePosition();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setEnabled(fine && !reduce);
  }, []);

  if (!enabled) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] mix-blend-soft-light"
      style={{
        background: `radial-gradient(420px circle at ${x}px ${y}px, rgba(212,175,55,0.12), transparent 55%)`,
      }}
    />
  );
}
