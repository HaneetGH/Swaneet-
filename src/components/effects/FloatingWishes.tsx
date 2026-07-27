"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { SAMPLE_WISHES } from "@/data/sample-wishes";

type Floater = {
  id: string;
  body: string;
  name: string;
  left: string;
  top: string;
  rotate: number;
  duration: number;
  delay: number;
  scale: number;
  opacity: number;
  maxWidth: number;
};

/**
 * Soft wish cards that drift behind the hero invitation (lower z-index).
 * Kept toward the edges so the center logo stays readable.
 */
export function FloatingWishes() {
  const items = useMemo<Floater[]>(() => {
    const layout = [
      { left: "4%", top: "18%", rotate: -8, maxWidth: 200 },
      { left: "78%", top: "16%", rotate: 7, maxWidth: 210 },
      { left: "2%", top: "48%", rotate: 5, maxWidth: 190 },
      { left: "82%", top: "46%", rotate: -6, maxWidth: 200 },
      { left: "8%", top: "72%", rotate: -4, maxWidth: 180 },
      { left: "74%", top: "74%", rotate: 8, maxWidth: 200 },
      { left: "22%", top: "12%", rotate: 3, maxWidth: 170 },
      { left: "58%", top: "80%", rotate: -5, maxWidth: 180 },
    ];

    return SAMPLE_WISHES.slice(0, layout.length).map((wish, index) => {
      const spot = layout[index]!;
      return {
        id: wish.id,
        body: wish.body.length > 110 ? `${wish.body.slice(0, 108)}…` : wish.body,
        name: wish.displayName,
        left: spot.left,
        top: spot.top,
        rotate: spot.rotate,
        duration: 10 + (index % 4) * 2.2,
        delay: index * 0.45,
        scale: 0.86 + (index % 3) * 0.06,
        opacity: 0.28 + (index % 4) * 0.06,
        maxWidth: spot.maxWidth,
      };
    });
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
    >
      {/* Soft veil so floaters sit behind the logo without fighting it */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(7,6,10,0.15)_0%,transparent_55%)]" />

      {items.map((item) => (
        <motion.div
          key={item.id}
          className="absolute hidden sm:block"
          style={{
            left: item.left,
            top: item.top,
            width: item.maxWidth,
            scale: item.scale,
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{
            opacity: [item.opacity * 0.55, item.opacity, item.opacity * 0.65],
            y: [0, -18, 0],
            x: [0, indexNudge(item.id), 0],
            rotate: [item.rotate - 1.5, item.rotate + 1.5, item.rotate - 1.5],
          }}
          transition={{
            duration: item.duration,
            delay: item.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="border border-gold/20 bg-[#120f16]/45 px-3.5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.25)] backdrop-blur-[2px]">
            <p className="font-display text-[13px] leading-snug text-cream/85">
              “{item.body}”
            </p>
            <p className="mt-2 font-body text-[9px] uppercase tracking-[0.18em] text-gold/70">
              — {item.name}
            </p>
          </div>
        </motion.div>
      ))}

      {/* Mobile: fewer, subtler floaters so the invitation stays clear */}
      {items.slice(0, 4).map((item, index) => (
        <motion.div
          key={`m-${item.id}`}
          className="absolute sm:hidden"
          style={{
            left: index % 2 === 0 ? "3%" : "58%",
            top: `${14 + index * 20}%`,
            width: index % 2 === 0 ? 140 : 150,
          }}
          animate={{
            opacity: [0.16, 0.28, 0.16],
            y: [0, -12, 0],
          }}
          transition={{
            duration: 9 + index,
            delay: index * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="border border-gold/15 bg-[#120f16]/35 px-2.5 py-2">
            <p className="font-display text-[11px] leading-snug text-cream/75">
              “{item.body.slice(0, 72)}…”
            </p>
            <p className="mt-1.5 font-body text-[8px] uppercase tracking-[0.16em] text-gold/60">
              — {item.name}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function indexNudge(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i) * 7) % 17;
  return hash - 8;
}
