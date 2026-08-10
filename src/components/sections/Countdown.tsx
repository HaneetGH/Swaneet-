"use client";

import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { wedding } from "@/data/wedding";
import { useCountdown } from "@/hooks/useCountdown";
import { useInvite } from "@/lib/invite-context";
import { pad } from "@/lib/utils";

const UNITS = [
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Mins" },
  { key: "seconds", label: "Secs" },
] as const;

export function Countdown() {
  const invite = useInvite();
  const target = invite?.invite.countdownTarget || wedding.countdownTarget;
  const parts = useCountdown(target);
  const fired = useRef(false);

  useEffect(() => {
    if (!parts.isComplete || fired.current) return;
    fired.current = true;
    const end = Date.now() + 2500;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#d4af37", "#e8d5a3", "#6b1d2a", "#f3e9d7"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#d4af37", "#e8d5a3", "#6b1d2a", "#f3e9d7"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [parts.isComplete]);

  const subtitle = invite
    ? invite.tier === "mehfil"
      ? "Until Sukhmani Sahib Path · 9 Aug"
      : "Until Haldi · 12 Aug"
    : "Until Wedding Dinner · 12 Aug";

  return (
    <motion.div
      id="countdown"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay: 0.2 }}
      className="flex flex-col items-center gap-1.5"
      aria-live="polite"
    >
      <p className="font-body text-[9px] uppercase tracking-[0.35em] text-gold/55">
        {subtitle}
      </p>

      {parts.isComplete ? (
        <p className="font-script text-lg text-gold-soft">
          The celebration begins!
        </p>
      ) : (
        <div className="flex items-stretch gap-2 sm:gap-3">
          {UNITS.map((unit, index) => (
            <div key={unit.key} className="flex items-stretch gap-2 sm:gap-3">
              {index > 0 ? (
                <span
                  aria-hidden
                  className="self-center font-display text-sm text-gold/30"
                >
                  :
                </span>
              ) : null}
              <div className="flex min-w-[2.4rem] flex-col items-center sm:min-w-[2.75rem]">
                <span className="font-display text-lg leading-none tracking-wide text-cream/90 sm:text-xl">
                  {pad(parts[unit.key])}
                </span>
                <span className="mt-0.5 font-body text-[8px] uppercase tracking-[0.28em] text-muted">
                  {unit.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
