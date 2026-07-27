"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { SAMPLE_WISHES } from "@/data/sample-wishes";
import { cn } from "@/lib/utils";

type WishItem = { id: string; body: string; name: string };

type Lane = {
  id: string;
  direction: "ltr" | "rtl";
  top: string;
  duration: number;
  /** Mix of flowing lines + light quote tiles */
  style: "line" | "card";
  wishes: WishItem[];
};

type FloatingWishesProps = {
  /** hero = landing page behind couple names; gate = sealed scroll first screen */
  variant?: "hero" | "gate";
  className?: string;
};

const SAMPLE_POOL: WishItem[] = SAMPLE_WISHES.map((wish) => ({
  id: wish.id,
  body: wish.body,
  name: wish.displayName,
}));

/**
 * Continuous L↔R flow behind the invitation.
 * Mix of soft text lines and light quote tiles (no heavy card grid).
 * Person-written wishes win; samples only when the wall is still empty.
 * Center blur on the parent screen makes them readable only outside the blur.
 */
export function FloatingWishes({
  variant = "hero",
  className,
}: FloatingWishesProps) {
  const [pool, setPool] = useState<WishItem[]>(SAMPLE_POOL);

  useEffect(() => {
    let active = true;
    fetch("/api/messages", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data: {
          messages?: Array<{ id: string; body: string; displayName: string }>;
        } | null) => {
          if (!active || !data?.messages?.length) return;
          const mapped = data.messages.map((wish) => ({
            id: wish.id,
            body: wish.body,
            name: wish.displayName,
          }));
          setPool(preferRealWishes(mapped));
        },
      )
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const lanes = useMemo<Lane[]>(() => {
    if (pool.length === 0) return [];

    const tops =
      variant === "gate"
        ? ["7%", "24%", "42%", "60%", "78%"]
        : ["8%", "26%", "44%", "62%", "80%"];

    return tops.map((top, index) => {
      const rotated = [
        ...pool.slice(index * 3),
        ...pool.slice(0, index * 3),
      ];
      const row = [...rotated, ...rotated];
      return {
        id: `lane-${index}`,
        direction: index % 2 === 0 ? ("ltr" as const) : ("rtl" as const),
        top,
        duration: 52 + index * 7,
        style: index % 2 === 0 ? ("line" as const) : ("card" as const),
        wishes: row,
      };
    });
  }, [pool, variant]);

  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 z-[1] overflow-hidden",
        className,
      )}
    >
      {lanes.map((lane) => (
        <div
          key={lane.id}
          className="absolute inset-x-0 overflow-hidden"
          style={{ top: lane.top }}
        >
          <motion.div
            className={cn(
              "flex w-max items-center",
              lane.style === "line" ? "gap-10 sm:gap-14" : "gap-5 sm:gap-7",
            )}
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
            {lane.wishes.map((wish, index) =>
              lane.style === "line" ? (
                <p
                  key={`${lane.id}-${wish.id}-${index}`}
                  className="shrink-0 whitespace-nowrap font-display text-[13px] text-cream/55 sm:text-[15px]"
                >
                  <span className="text-cream/70">“{wish.body}”</span>
                  <span className="ml-3 font-body text-[9px] uppercase tracking-[0.22em] text-gold/55 sm:text-[10px]">
                    — {wish.name}
                  </span>
                  <span className="ml-10 inline-block text-gold/25" aria-hidden>
                    ·
                  </span>
                </p>
              ) : (
                <article
                  key={`${lane.id}-${wish.id}-${index}`}
                  className="w-[15rem] shrink-0 border border-gold/20 bg-[#120e16]/35 px-3.5 py-3 backdrop-blur-[1px] sm:w-[17.5rem] sm:px-4 sm:py-3.5"
                >
                  <p className="font-display text-[13px] leading-snug text-cream/70 sm:text-[14px]">
                    “{wish.body}”
                  </p>
                  <p className="mt-2 font-body text-[9px] uppercase tracking-[0.2em] text-gold/50 sm:text-[10px]">
                    — {wish.name}
                  </p>
                </article>
              ),
            )}
          </motion.div>
        </div>
      ))}
    </div>
  );
}
