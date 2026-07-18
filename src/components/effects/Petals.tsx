"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

const COUNT = 14;

export function Petals() {
  const petals = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => ({
        id: i,
        left: `${(i * 7.3) % 100}%`,
        delay: (i % 7) * 0.8,
        duration: 14 + (i % 5) * 2.5,
        size: 8 + (i % 4) * 3,
        rotate: i * 40,
      })),
    [],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {petals.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-[-10%] block rounded-[60%_40%_60%_40%] bg-gradient-to-br from-[#e8b4b8]/70 to-[#c97b84]/40"
          style={{
            left: p.left,
            width: p.size,
            height: p.size * 1.35,
            rotate: p.rotate,
          }}
          animate={{
            y: ["0vh", "110vh"],
            x: [0, 20, -15, 10, 0],
            rotate: [p.rotate, p.rotate + 180, p.rotate + 360],
            opacity: [0, 0.75, 0.75, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}
