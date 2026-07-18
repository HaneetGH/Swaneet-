"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

export function Sparkles({ count = 18 }: { count?: number }) {
  const dots = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: `${(i * 13) % 100}%`,
        top: `${(i * 19) % 100}%`,
        delay: (i % 6) * 0.4,
      })),
    [count],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {dots.map((d) => (
        <motion.span
          key={d.id}
          className="absolute h-1 w-1 rounded-full bg-gold-soft"
          style={{ left: d.left, top: d.top }}
          animate={{ opacity: [0, 1, 0], scale: [0.4, 1.4, 0.4] }}
          transition={{
            duration: 2.8,
            delay: d.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
