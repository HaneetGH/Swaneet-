"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { SAMPLE_WISHES } from "@/data/sample-wishes";
import { cn } from "@/lib/utils";

type Floater = {
  id: string;
  body: string;
  name: string;
  left: string;
  top: string;
  rotate: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  maxWidth: number;
};

type FloatingWishesProps = {
  /** hero = landing page behind couple names; gate = sealed scroll first screen */
  variant?: "hero" | "gate";
  className?: string;
};

/**
 * Readable wish cards that continuously drift behind the invitation UI.
 * Anyone can read them; posting still requires Google login on the Wishes section.
 */
export function FloatingWishes({
  variant = "hero",
  className,
}: FloatingWishesProps) {
  const items = useMemo<Floater[]>(() => {
    const layout =
      variant === "gate"
        ? [
            { left: "3%", top: "10%", rotate: -7, maxWidth: 280, driftX: 28, driftY: 36 },
            { left: "72%", top: "8%", rotate: 6, maxWidth: 300, driftX: -24, driftY: 40 },
            { left: "2%", top: "38%", rotate: 4, maxWidth: 270, driftX: 32, driftY: -28 },
            { left: "74%", top: "36%", rotate: -5, maxWidth: 290, driftX: -30, driftY: 34 },
            { left: "5%", top: "66%", rotate: -3, maxWidth: 260, driftX: 22, driftY: -32 },
            { left: "70%", top: "68%", rotate: 7, maxWidth: 280, driftX: -26, driftY: -24 },
            { left: "28%", top: "78%", rotate: 2, maxWidth: 250, driftX: 18, driftY: -20 },
            { left: "48%", top: "6%", rotate: -4, maxWidth: 240, driftX: -16, driftY: 30 },
          ]
        : [
            { left: "2%", top: "14%", rotate: -8, maxWidth: 300, driftX: 30, driftY: 38 },
            { left: "74%", top: "12%", rotate: 7, maxWidth: 310, driftX: -28, driftY: 42 },
            { left: "1%", top: "42%", rotate: 5, maxWidth: 290, driftX: 34, driftY: -30 },
            { left: "76%", top: "44%", rotate: -6, maxWidth: 300, driftX: -32, driftY: 36 },
            { left: "4%", top: "70%", rotate: -4, maxWidth: 270, driftX: 24, driftY: -34 },
            { left: "72%", top: "72%", rotate: 8, maxWidth: 290, driftX: -28, driftY: -26 },
            { left: "22%", top: "8%", rotate: 3, maxWidth: 250, driftX: -18, driftY: 28 },
            { left: "52%", top: "82%", rotate: -5, maxWidth: 260, driftX: 20, driftY: -22 },
          ];

    return SAMPLE_WISHES.slice(0, layout.length).map((wish, index) => {
      const spot = layout[index]!;
      return {
        id: wish.id,
        body: wish.body,
        name: wish.displayName,
        left: spot.left,
        top: spot.top,
        rotate: spot.rotate,
        duration: 14 + (index % 5) * 2.4,
        delay: index * 0.35,
        driftX: spot.driftX,
        driftY: spot.driftY,
        maxWidth: spot.maxWidth,
      };
    });
  }, [variant]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] overflow-hidden",
        className,
      )}
    >
      {/* Keep center clearer so seal / couple names stay primary */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(7,6,10,0.55)_0%,rgba(7,6,10,0.12)_42%,transparent_68%)]" />

      {items.map((item) => (
        <motion.div
          key={item.id}
          className="absolute"
          style={{
            left: item.left,
            top: item.top,
            width: item.maxWidth,
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{
            opacity: [0.72, 0.95, 0.78, 0.95],
            x: [0, item.driftX, item.driftX * -0.45, 0],
            y: [0, -item.driftY, item.driftY * 0.35, 0],
            rotate: [
              item.rotate - 2,
              item.rotate + 3,
              item.rotate - 1,
              item.rotate - 2,
            ],
          }}
          transition={{
            duration: item.duration,
            delay: item.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="border border-gold/35 bg-[#16121c]/82 px-4 py-4 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-[3px] sm:px-5 sm:py-5">
            <p className="font-display text-[15px] leading-relaxed text-cream sm:text-[17px]">
              “{item.body}”
            </p>
            <p className="mt-3 font-body text-[10px] uppercase tracking-[0.2em] text-gold-soft sm:text-[11px]">
              — {item.name}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
