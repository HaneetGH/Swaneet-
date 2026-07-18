"use client";

import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { useEffect, useRef } from "react";
import { wedding } from "@/data/wedding";
import { useCountdown } from "@/hooks/useCountdown";
import { pad } from "@/lib/utils";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";

function Ring({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = max === 0 ? 0 : value / max;
  const offset = circumference * (1 - Math.min(1, progress));

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-28 w-28 sm:h-32 sm:w-32">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="rgba(255,248,230,0.08)"
            strokeWidth="3"
          />
          <motion.circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="url(#goldGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#9a7b2f" />
              <stop offset="50%" stopColor="#d4af37" />
              <stop offset="100%" stopColor="#e8d5a3" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-3xl text-cream sm:text-4xl">
            {pad(value)}
          </span>
        </div>
      </div>
      <span className="font-body text-[10px] uppercase tracking-[0.3em] text-muted">
        {label}
      </span>
    </div>
  );
}

export function Countdown() {
  const parts = useCountdown(wedding.countdownTarget);
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

  return (
    <section id="countdown" className="section-pad relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,175,55,0.06),transparent_60%)]" />
      <div className="relative mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Save the date"
          title="Counting Down"
          subtitle="Until the Wedding Dinner on 12th August 2026"
        />

        <GlassCard glow className="mx-auto max-w-3xl">
          {parts.isComplete ? (
            <p className="text-center font-script text-4xl text-gold-soft">
              The celebration begins!
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 sm:gap-4">
              <Ring value={parts.days} max={365} label="Days" />
              <Ring value={parts.hours} max={24} label="Hours" />
              <Ring value={parts.minutes} max={60} label="Minutes" />
              <Ring value={parts.seconds} max={60} label="Seconds" />
            </div>
          )}
        </GlassCard>
      </div>
    </section>
  );
}
