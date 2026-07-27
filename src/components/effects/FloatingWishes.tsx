"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { buildDisplayWishPool } from "@/data/sample-wishes";
import { cn } from "@/lib/utils";

type WishItem = { id: string; body: string; name: string; source?: string };

type FloatingSlot = {
  id: string;
  side: "left" | "right";
  top: string;
  style: "line" | "card";
  duration: number;
  delay: number;
  wish: WishItem;
};

type FloatingWishesProps = {
  /** hero = landing page behind couple names; gate = sealed scroll first screen */
  variant?: "hero" | "gate";
  className?: string;
};

const LEFT_TOPS = ["10%", "28%", "46%", "64%", "80%"];
const RIGHT_TOPS = ["14%", "32%", "50%", "68%", "84%"];

/**
 * Unique wishes floating on both left and right edges.
 * Never repeats one review across the screen.
 */
export function FloatingWishes({
  variant = "hero",
  className,
}: FloatingWishesProps) {
  const [pool, setPool] = useState<WishItem[]>([]);

  useEffect(() => {
    let active = true;
    fetch("/api/messages", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          messages?: Array<{
            id: string;
            body: string;
            displayName: string;
            source?: string;
          }>;
        } | null) => {
          if (!active || !data?.messages?.length) return;
          const mapped = data.messages.map((wish) => ({
            id: wish.id,
            body: wish.body,
            name: wish.displayName,
            source: wish.source,
          }));
          setPool(buildDisplayWishPool(mapped));
        },
      )
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const slots = useMemo<FloatingSlot[]>(() => {
    if (pool.length === 0) return [];

    const leftTops = variant === "gate" ? LEFT_TOPS.slice(0, 4) : LEFT_TOPS;
    const rightTops = variant === "gate" ? RIGHT_TOPS.slice(0, 4) : RIGHT_TOPS;
    const maxSlots = leftTops.length + rightTops.length;

    // One unique wish per visible slot — never clone the same review
    const unique = pool.slice(0, maxSlots);
    const result: FloatingSlot[] = [];

    unique.forEach((wish, index) => {
      const onLeft = index % 2 === 0;
      const sideIndex = Math.floor(index / 2);
      const tops = onLeft ? leftTops : rightTops;
      const top = tops[sideIndex % tops.length] || "20%";

      result.push({
        id: `slot-${wish.id}`,
        side: onLeft ? "left" : "right",
        top,
        style: index % 3 === 1 ? "card" : "line",
        duration: 7 + (index % 4) * 1.4,
        delay: index * 0.35,
        wish,
      });
    });

    return result;
  }, [pool, variant]);

  if (slots.length === 0) return null;

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] overflow-hidden",
        className,
      )}
    >
      {slots.map((slot) => (
        <motion.div
          key={slot.id}
          className={cn(
            "absolute max-w-[13.5rem] sm:max-w-[16.5rem]",
            slot.side === "left"
              ? "left-3 text-left sm:left-6 md:left-10"
              : "right-3 text-right sm:right-6 md:right-10",
          )}
          style={{ top: slot.top }}
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: [0.4, 0.9, 0.5],
            y: [0, -14, 0],
          }}
          transition={{
            duration: slot.duration,
            delay: slot.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {slot.style === "card" ? (
            <article className="border border-gold/20 bg-[#120e16]/40 px-3.5 py-3 backdrop-blur-[1px]">
              <p className="font-display text-[13px] leading-snug text-cream/80 sm:text-[14px]">
                “{slot.wish.body}”
              </p>
              <p className="mt-2 font-body text-[9px] uppercase tracking-[0.2em] text-gold/55 sm:text-[10px]">
                — {slot.wish.name}
              </p>
            </article>
          ) : (
            <blockquote>
              <p className="font-display text-[13px] leading-snug text-cream/75 sm:text-[14px]">
                “{slot.wish.body}”
              </p>
              <footer className="mt-2 font-body text-[9px] uppercase tracking-[0.22em] text-gold/50 sm:text-[10px]">
                — {slot.wish.name}
              </footer>
            </blockquote>
          )}
        </motion.div>
      ))}
    </div>
  );
}
