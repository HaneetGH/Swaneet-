"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const COUNT = 22;

export function Fireflies() {
  const flies = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        id: i,
        x: `${(i * 17 + 5) % 95}%`,
        y: `${(i * 23 + 10) % 85}%`,
        delay: (i % 9) * 0.45,
        duration: 3 + (i % 4),
        size: 2 + (i % 3),
      })),
    [],
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {flies.map((f) => (
        <motion.span
          key={f.id}
          className="absolute rounded-full bg-gold-soft shadow-[0_0_10px_2px_rgba(232,213,163,0.55)]"
          style={{
            left: f.x,
            top: f.y,
            width: f.size,
            height: f.size,
          }}
          animate={{
            opacity: [0.15, 0.95, 0.2],
            y: [0, -12, 6, 0],
            x: [0, 8, -6, 0],
          }}
          transition={{
            duration: f.duration,
            delay: f.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
