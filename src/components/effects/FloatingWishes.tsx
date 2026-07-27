"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { SAMPLE_WISHES } from "@/data/sample-wishes";
import { cn } from "@/lib/utils";

type Lane = {
  id: string;
  direction: "ltr" | "rtl";
  top: string;
  duration: number;
  scale: number;
  wishes: Array<{ id: string; body: string; name: string }>;
};

type FloatingWishesProps = {
  /** hero = landing page behind couple names; gate = sealed scroll first screen */
  variant?: "hero" | "gate";
  className?: string;
};

/**
 * Continuous left↔right floating wish lanes (same linear marquee motion as the Wishes wall).
 * Sits behind the invitation UI. Anyone can read; posting still needs Google login.
 */
export function FloatingWishes({
  variant = "hero",
  className,
}: FloatingWishesProps) {
  const lanes = useMemo<Lane[]>(() => {
    const pool = SAMPLE_WISHES.map((wish) => ({
      id: wish.id,
      body: wish.body,
      name: wish.displayName,
    }));

    const tops =
      variant === "gate"
        ? ["8%", "28%", "52%", "74%"]
        : ["10%", "32%", "56%", "78%"];

    return tops.map((top, index) => {
      // Offset each lane's starting slice so rows don't look identical
      const rotated = [
        ...pool.slice(index * 2),
        ...pool.slice(0, index * 2),
      ];
      const row = [...rotated, ...rotated];
      return {
        id: `lane-${index}`,
        direction: index % 2 === 0 ? ("ltr" as const) : ("rtl" as const),
        top,
        duration: 48 + index * 8,
        scale: 0.92 + (index % 2) * 0.06,
        wishes: row,
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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(7,6,10,0.62)_0%,rgba(7,6,10,0.18)_40%,transparent_66%)]" />

      {lanes.map((lane) => (
        <div
          key={lane.id}
          className="absolute inset-x-0 overflow-hidden"
          style={{ top: lane.top }}
        >
          <motion.div
            className="flex w-max gap-5"
            style={{ scale: lane.scale }}
            animate={
              lane.direction === "ltr"
                ? { x: ["-50%", "0%"] }
                : { x: ["0%", "-50%"] }
            }
            transition={{
              duration: lane.duration,
              ease: "linear",
              repeat: Infinity,
            }}
          >
            {lane.wishes.map((wish, index) => (
              <article
                key={`${lane.id}-${wish.id}-${index}`}
                className="w-[16.5rem] shrink-0 border border-gold/35 bg-[#16121c]/88 px-4 py-4 shadow-[0_16px_48px_rgba(0,0,0,0.45)] backdrop-blur-[3px] sm:w-[20rem] sm:px-5 sm:py-5"
              >
                <p className="font-display text-[15px] leading-relaxed text-cream sm:text-[17px]">
                  “{wish.body}”
                </p>
                <p className="mt-3 font-body text-[10px] uppercase tracking-[0.2em] text-gold-soft sm:text-[11px]">
                  — {wish.name}
                </p>
              </article>
            ))}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
