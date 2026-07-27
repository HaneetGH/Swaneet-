"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { SAMPLE_WISHES } from "@/data/sample-wishes";
import { cn } from "@/lib/utils";

type FloatingWishesProps = {
  /** hero = landing page behind couple names; gate = sealed scroll first screen */
  variant?: "hero" | "gate";
  className?: string;
};

type WhisperSlot = {
  id: string;
  /** Tailwind-ish placement */
  className: string;
  /** Prefer shorter quotes for edge placement */
  maxLen: number;
};

const HERO_SLOTS: WhisperSlot[] = [
  {
    id: "nw",
    className: "left-[4%] top-[14%] max-w-[13rem] text-left sm:left-[6%] sm:max-w-[16rem]",
    maxLen: 90,
  },
  {
    id: "ne",
    className: "right-[4%] top-[18%] max-w-[13rem] text-right sm:right-[6%] sm:max-w-[16rem]",
    maxLen: 90,
  },
  {
    id: "sw",
    className: "bottom-[16%] left-[5%] max-w-[14rem] text-left sm:bottom-[18%] sm:max-w-[17rem]",
    maxLen: 100,
  },
  {
    id: "se",
    className: "bottom-[14%] right-[5%] max-w-[14rem] text-right sm:bottom-[16%] sm:max-w-[17rem]",
    maxLen: 100,
  },
];

const GATE_SLOTS: WhisperSlot[] = [
  {
    id: "nw",
    className: "left-[5%] top-[10%] max-w-[12rem] text-left sm:left-[8%] sm:max-w-[15rem]",
    maxLen: 80,
  },
  {
    id: "ne",
    className: "right-[5%] top-[12%] max-w-[12rem] text-right sm:right-[8%] sm:max-w-[15rem]",
    maxLen: 80,
  },
  {
    id: "sw",
    className: "bottom-[12%] left-[6%] max-w-[13rem] text-left sm:max-w-[15rem]",
    maxLen: 85,
  },
  {
    id: "se",
    className: "bottom-[10%] right-[6%] max-w-[13rem] text-right sm:max-w-[15rem]",
    maxLen: 85,
  },
];

/**
 * Classy backdrop: soft typographic “whispers” at the edges only.
 * No cards, borders, or marquees — invitation / couple names stay the focus.
 */
export function FloatingWishes({
  variant = "hero",
  className,
}: FloatingWishesProps) {
  const slots = variant === "gate" ? GATE_SLOTS : HERO_SLOTS;
  const pool = useMemo(
    () =>
      SAMPLE_WISHES.map((wish) => ({
        id: wish.id,
        body: wish.body,
        name: wish.displayName,
      })),
    [],
  );

  const [indices, setIndices] = useState(() =>
    slots.map((_, i) => i % pool.length),
  );

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || pool.length === 0) return;

    const timers = slots.map((_, slotIndex) =>
      window.setInterval(
        () => {
          setIndices((prev) => {
            const next = [...prev];
            next[slotIndex] = (next[slotIndex] + slots.length) % pool.length;
            return next;
          });
        },
        7000 + slotIndex * 1600,
      ),
    );

    return () => timers.forEach(clearInterval);
  }, [pool.length, slots]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] overflow-hidden",
        className,
      )}
    >
      {/* Soft vignette keeps the center (seal / names) dominant */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(7,6,10,0.72)_0%,rgba(7,6,10,0.28)_42%,transparent_68%)]" />

      {/* Hairline gold frame — subtle luxury, not clutter */}
      <div className="absolute inset-6 border border-gold/10 sm:inset-10" />
      <div className="absolute inset-[1.65rem] border border-gold/[0.04] sm:inset-[2.65rem]" />

      {slots.map((slot, slotIndex) => {
        const wish = pool[indices[slotIndex] % pool.length];
        if (!wish) return null;
        const body =
          wish.body.length > slot.maxLen
            ? `${wish.body.slice(0, slot.maxLen - 1).trimEnd()}…`
            : wish.body;

        return (
          <div key={slot.id} className={cn("absolute", slot.className)}>
            <AnimatePresence mode="wait">
              <motion.blockquote
                key={wish.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                className="select-none"
              >
                <p className="font-display text-[13px] leading-relaxed text-cream/35 sm:text-[15px]">
                  “{body}”
                </p>
                <footer className="mt-2 font-body text-[9px] uppercase tracking-[0.28em] text-gold/40 sm:text-[10px]">
                  — {wish.name}
                </footer>
              </motion.blockquote>
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
