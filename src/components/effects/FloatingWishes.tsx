"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { buildDisplayWishPool, SAMPLE_WISHES } from "@/data/sample-wishes";

type WishItem = { id: string; body: string; name: string; source?: string };

type FloatingWishesProps = {
  /**
   * hero = one rotating blessing under the couple names
   * gate = unused (kept for call-site compatibility; renders nothing)
   */
  variant?: "hero" | "gate";
  className?: string;
};

/** Instant public fallback — visible without login / API wait */
const PUBLIC_FALLBACK: WishItem[] = buildDisplayWishPool(
  SAMPLE_WISHES.map((wish) => ({
    id: wish.id,
    body: wish.body,
    name: wish.displayName,
    source: "sample" as const,
  })),
);

/**
 * Classy hero treatment: a single rotating guest blessing.
 * Keeps the invitation / couple names as the focus — no side clutter.
 */
export function FloatingWishes({
  variant = "hero",
  className,
}: FloatingWishesProps) {
  const [pool, setPool] = useState<WishItem[]>(PUBLIC_FALLBACK);
  const [index, setIndex] = useState(0);

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
          setIndex(0);
        },
      )
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (pool.length <= 1) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % pool.length);
    }, 5600);
    return () => window.clearInterval(timer);
  }, [pool.length]);

  // Seal screen stays clean — blessings live on the hero + wishes wall
  if (variant === "gate") return null;
  if (pool.length === 0) return null;

  const wish = pool[index % pool.length];
  if (!wish) return null;

  return (
    <div className="pointer-events-none relative z-[1] mx-auto mt-8 w-full max-w-xl px-2">
      <p className="mb-3 text-center font-body text-[10px] uppercase tracking-[0.32em] text-gold/55">
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
            <p className="font-display text-lg leading-relaxed text-cream/90 sm:text-xl md:text-[1.35rem]">
              “{wish.body}”
            </p>
            <footer className="mt-3 font-body text-[11px] uppercase tracking-[0.24em] text-gold-soft sm:text-xs">
              — {wish.name}
            </footer>
          </motion.blockquote>
        </AnimatePresence>
      </div>
    </div>
  );
}
