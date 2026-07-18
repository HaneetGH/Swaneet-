"use client";

import { motion } from "framer-motion";

const lanterns = [
  { left: "8%", delay: 0, scale: 0.85 },
  { left: "18%", delay: 1.2, scale: 0.65 },
  { left: "78%", delay: 0.6, scale: 0.75 },
  { left: "88%", delay: 1.8, scale: 0.9 },
];

export function FloatingLanterns() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {lanterns.map((l, i) => (
        <motion.div
          key={i}
          className="absolute top-[12%]"
          style={{ left: l.left, scale: l.scale }}
          animate={{ y: [0, -18, 0], opacity: [0.55, 0.9, 0.55] }}
          transition={{
            duration: 7 + i,
            delay: l.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="relative mx-auto h-10 w-7">
            <div className="absolute inset-x-1 top-0 h-2 rounded-t-full bg-gold/70" />
            <div className="absolute inset-x-0 top-2 h-8 rounded-b-[40%] bg-gradient-to-b from-gold/50 via-gold-deep/40 to-maroon/40 shadow-[0_0_24px_rgba(212,175,55,0.35)]" />
            <div className="absolute inset-x-2 top-4 h-3 rounded-full bg-gold-soft/40 blur-[1px]" />
          </div>
          <div className="mx-auto h-16 w-px bg-gradient-to-b from-gold/40 to-transparent" />
        </motion.div>
      ))}
    </div>
  );
}
