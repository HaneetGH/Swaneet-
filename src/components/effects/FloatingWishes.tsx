"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { buildDisplayWishPool, SAMPLE_WISHES } from "@/data/sample-wishes";
import { cn } from "@/lib/utils";

type WishItem = { id: string; body: string; name: string; source?: string };

type FloatingSlot = {
  id: string;
  side: "left" | "right";
  top: string;
  wish: WishItem;
  duration: number;
  delay: number;
};

type WishPoolProps = {
  variant?: "hero" | "gate";
  className?: string;
};

const LEFT_TOPS = ["11%", "30%", "49%", "68%", "84%"];
const RIGHT_TOPS = ["16%", "35%", "54%", "73%", "88%"];

/** Instant public fallback — visible without login / API wait */
const PUBLIC_FALLBACK: WishItem[] = buildDisplayWishPool(
  SAMPLE_WISHES.map((wish) => ({
    id: wish.id,
    body: wish.body,
    name: wish.displayName,
    source: "sample" as const,
  })),
);

function useWishPool() {
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
          setPool(
            buildDisplayWishPool(
              data.messages.map((wish) => ({
                id: wish.id,
                body: wish.body,
                name: wish.displayName,
                source: wish.source,
              })),
            ),
          );
        },
      )
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return pool;
}

/**
 * Soft blurred background wishes — atmospheric only, behind the invitation.
 */
export function FloatingWishBackdrop({
  variant = "hero",
  className,
}: WishPoolProps) {
  const pool = useWishPool();

  const slots = useMemo<FloatingSlot[]>(() => {
    if (pool.length === 0) return [];
    const leftTops = variant === "gate" ? LEFT_TOPS.slice(0, 4) : LEFT_TOPS;
    const rightTops = variant === "gate" ? RIGHT_TOPS.slice(0, 4) : RIGHT_TOPS;
    const maxSlots = leftTops.length + rightTops.length;
    // Skip the first wish so the spotlight can feature it without doubling immediately
    const unique = pool.slice(1, 1 + maxSlots);
    const source = unique.length > 0 ? unique : pool.slice(0, maxSlots);

    return source.map((wish, index) => {
      const onLeft = index % 2 === 0;
      const sideIndex = Math.floor(index / 2);
      const tops = onLeft ? leftTops : rightTops;
      return {
        id: `bg-${wish.id}`,
        side: (onLeft ? "left" : "right") as "left" | "right",
        top: tops[sideIndex % tops.length] || "20%",
        wish,
        duration: 9 + (index % 4) * 1.3,
        delay: index * 0.3,
      };
    });
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
      {/* Soft blur so background wishes stay atmospheric */}
      <div className="absolute inset-0 scale-[1.01] blur-[2px] sm:blur-[2.5px]">
        {slots.map((slot) => (
          <motion.div
            key={slot.id}
            className={cn(
              "absolute max-w-[12.5rem] sm:max-w-[15rem]",
              slot.side === "left"
                ? "left-2 text-left sm:left-5 md:left-8"
                : "right-2 text-right sm:right-5 md:right-8",
            )}
            style={{ top: slot.top }}
            animate={{
              opacity: [0.18, 0.38, 0.22],
              y: [0, -12, 0],
            }}
            transition={{
              duration: slot.duration,
              delay: slot.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          >
            <p className="font-display text-[13px] leading-snug text-cream/70 sm:text-[14px]">
              “{slot.wish.body}”
            </p>
            <p className="mt-2 font-body text-[9px] uppercase tracking-[0.2em] text-gold/45 sm:text-[10px]">
              — {slot.wish.name}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/**
 * Focused rotating blessing under the couple names.
 * Clicking opens the full wishes section.
 */
export function FloatingWishes({
  variant = "hero",
  className,
}: WishPoolProps) {
  const pool = useWishPool();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (pool.length <= 1) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % pool.length);
    }, 5600);
    return () => window.clearInterval(timer);
  }, [pool.length]);

  if (variant === "gate") return null;
  if (pool.length === 0) return null;

  const wish = pool[index % pool.length];
  if (!wish) return null;

  return (
    <div className={cn("relative z-[1] mx-auto mt-8 w-full max-w-xl px-2", className)}>
      <a
        href="#wishes"
        className="group block rounded-sm outline-none transition focus-visible:ring-1 focus-visible:ring-gold/50"
        aria-label="View all guest wishes"
      >
        <p className="mb-3 text-center font-body text-[10px] uppercase tracking-[0.32em] text-gold/60 transition group-hover:text-gold">
          A blessing from our guests
        </p>

        <div className="relative min-h-[5.5rem] sm:min-h-[6rem]">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={wish.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-x-0 top-0 text-center"
            >
              <p className="font-display text-lg leading-relaxed text-cream/90 transition group-hover:text-cream sm:text-xl md:text-[1.35rem]">
                “{wish.body}”
              </p>
              <footer className="mt-3 font-body text-[11px] uppercase tracking-[0.24em] text-gold-soft sm:text-xs">
                — {wish.name}
              </footer>
            </motion.blockquote>
          </AnimatePresence>
        </div>

        <p className="mt-4 text-center font-body text-[10px] uppercase tracking-[0.28em] text-gold/45 transition group-hover:text-gold/70">
          Read all wishes
        </p>
      </a>
    </div>
  );
}
