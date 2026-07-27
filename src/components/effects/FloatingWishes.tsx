"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { buildDisplayWishPool, SAMPLE_WISHES } from "@/data/sample-wishes";
import { cn } from "@/lib/utils";

type WishItem = { id: string; body: string; name: string; source?: string };

type WishLane = {
  id: string;
  top: string;
  wishes: WishItem[];
};

type WishPoolProps = {
  variant?: "hero" | "gate";
  className?: string;
};

/** One shared marquee speed for every lane — slow, calm drift */
const FLOW_DURATION = 96;

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

/** Matches the faceted / hexagonal crystal behind the hero names */
const HEX_CLIP =
  "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";

function HexBlur({ sizeClass }: { sizeClass: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[44%] z-[2] -translate-x-1/2 -translate-y-1/2"
    >
      {/* Soft gold haze behind the hex */}
      <div
        className={cn(
          "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/12 blur-3xl",
          sizeClass,
        )}
      />
      {/* Hexagonal blur plate — wishes soften only inside this shape */}
      <div
        className={cn(
          "relative border border-gold/30 bg-[linear-gradient(145deg,rgba(255,246,216,0.14),rgba(212,175,55,0.08)_40%,rgba(7,6,10,0.4)_100%)] shadow-[0_0_70px_rgba(232,213,163,0.16)] backdrop-blur-md sm:backdrop-blur-lg",
          sizeClass,
        )}
        style={{ clipPath: HEX_CLIP }}
      />
      {/* Thin gold hex outline */}
      <div
        className={cn(
          "pointer-events-none absolute inset-0 border border-gold/35",
          sizeClass,
        )}
        style={{ clipPath: HEX_CLIP }}
      />
    </div>
  );
}

/**
 * Background wishes drift left→right at one speed behind a hexagonal blur.
 * Readable outside the hex; softly blurred as they pass through it.
 */
export function FloatingWishBackdrop({
  variant = "hero",
  className,
}: WishPoolProps) {
  const pool = useWishPool();

  const lanes = useMemo<WishLane[]>(() => {
    if (pool.length === 0) return [];

    const tops =
      variant === "gate"
        ? ["12%", "32%", "52%", "72%"]
        : ["10%", "28%", "46%", "64%", "80%"];

    return tops.map((top, index) => {
      const rotated = [
        ...pool.slice(index * 2),
        ...pool.slice(0, index * 2),
      ];
      const row =
        rotated.length < 4
          ? [...rotated, ...rotated, ...rotated, ...rotated]
          : [...rotated, ...rotated];

      return {
        id: `lane-${index}`,
        top,
        wishes: row,
      };
    });
  }, [pool, variant]);

  if (lanes.length === 0) return null;

  const hexSize =
    variant === "gate"
      ? "h-[min(68vw,22rem)] w-[min(68vw,22rem)] sm:h-[24rem] sm:w-[24rem]"
      : "h-[min(78vw,26rem)] w-[min(78vw,26rem)] sm:h-[30rem] sm:w-[30rem] md:h-[34rem] md:w-[34rem]";

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
            className="flex w-max items-center gap-10 sm:gap-14"
            animate={{ x: ["-50%", "0%"] }}
            transition={{
              duration: FLOW_DURATION,
              ease: "linear",
              repeat: Infinity,
            }}
          >
            {lane.wishes.map((wish, index) => (
              <p
                key={`${lane.id}-${wish.id}-${index}`}
                className="shrink-0 whitespace-nowrap font-display text-[15px] text-cream/80 sm:text-[16px] md:text-[17px]"
              >
                <span>“{wish.body}”</span>
                <span className="ml-3 font-body text-[10px] uppercase tracking-[0.22em] text-gold/65 sm:text-[11px]">
                  — {wish.name}
                </span>
                <span className="ml-10 inline-block text-gold/30" aria-hidden>
                  ·
                </span>
              </p>
            ))}
          </motion.div>
        </div>
      ))}

      <HexBlur sizeClass={hexSize} />
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
