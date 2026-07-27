"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { buildDisplayWishPool, SAMPLE_WISHES } from "@/data/sample-wishes";
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

const LEFT_TOPS = ["9%", "27%", "45%", "63%", "79%"];
const RIGHT_TOPS = ["13%", "31%", "49%", "67%", "83%"];

/** Instant public fallback — no login / no API wait required */
const PUBLIC_FALLBACK: WishItem[] = buildDisplayWishPool(
  SAMPLE_WISHES.map((wish) => ({
    id: wish.id,
    body: wish.body,
    name: wish.displayName,
    source: "sample" as const,
  })),
);

/**
 * Unique wishes floating on both left and right edges.
 * Visible to everyone (logged out included) via public samples, then enriched from DB.
 */
export function FloatingWishes({
  variant = "hero",
  className,
}: FloatingWishesProps) {
  const [pool, setPool] = useState<WishItem[]>(PUBLIC_FALLBACK);

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
        duration: 8 + (index % 4) * 1.2,
        delay: index * 0.25,
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
            "absolute max-w-[15.5rem] sm:max-w-[19rem] md:max-w-[21rem]",
            slot.side === "left"
              ? "left-2 text-left sm:left-5 md:left-8"
              : "right-2 text-right sm:right-5 md:right-8",
          )}
          style={{ top: slot.top }}
          initial={{ opacity: 0, y: 8 }}
          animate={{
            opacity: [0.82, 1, 0.88],
            y: [0, -10, 0],
          }}
          transition={{
            duration: slot.duration,
            delay: slot.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {slot.style === "card" ? (
            <article className="border border-gold/30 bg-[#120e16]/70 px-4 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-[2px] sm:px-5 sm:py-4">
              <p className="font-display text-[16px] leading-snug text-cream sm:text-[18px] md:text-[19px]">
                “{slot.wish.body}”
              </p>
              <p className="mt-2.5 font-body text-[11px] uppercase tracking-[0.2em] text-gold-soft sm:text-xs">
                — {slot.wish.name}
              </p>
            </article>
          ) : (
            <blockquote className="rounded-sm bg-[#07060a]/35 px-1 py-1">
              <p className="font-display text-[16px] leading-snug text-cream sm:text-[18px] md:text-[19px]">
                “{slot.wish.body}”
              </p>
              <footer className="mt-2.5 font-body text-[11px] uppercase tracking-[0.2em] text-gold-soft sm:text-xs">
                — {slot.wish.name}
              </footer>
            </blockquote>
          )}
        </motion.div>
      ))}
    </div>
  );
}
