"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { wedding } from "@/data/wedding";
import { Fireflies } from "@/components/effects/Fireflies";
import { FloatingLanterns } from "@/components/effects/FloatingLanterns";
import { Petals } from "@/components/effects/Petals";
import { Sparkles } from "@/components/effects/Sparkles";
import { MusicToggle } from "@/components/ui/MusicToggle";
import { useInvite } from "@/lib/invite-context";

const Scene3D = dynamic(
  () =>
    import("@/components/effects/Scene3D").then((m) => m.Scene3D),
  { ssr: false },
);

export function Hero() {
  const invite = useInvite();
  const brideFirst = Boolean(invite);
  const primaryName = brideFirst
    ? wedding.couple.bride.name
    : wedding.couple.groom.name;
  const secondaryName = brideFirst
    ? wedding.couple.groom.name
    : wedding.couple.bride.name;
  const place =
    invite?.invite.heroPlace || "Maple Garden · Buria Road, Jagadhri";
  const blessing = invite?.invite.blessings || wedding.blessing;

  return (
    <section
      id="hero"
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden ambient-bg"
    >
      <Scene3D />
      <FloatingLanterns />
      <Petals />
      <Fireflies />
      <Sparkles />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(7,6,10,0.55)_70%,rgba(7,6,10,0.92)_100%)]" />

      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-28 text-center">
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mb-6 max-w-lg font-body text-[11px] leading-relaxed tracking-[0.12em] text-gold-soft/80 sm:text-xs"
        >
          {blessing}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mb-4 flex items-center gap-4 text-gold/70"
          aria-hidden
        >
          <span className="text-xl">☬</span>
          <span className="font-display text-3xl">ੴ</span>
          <span className="text-xl">☬</span>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.45 }}
          className="mb-3 font-body text-[10px] uppercase tracking-[0.45em] text-muted"
        >
          {invite ? invite.invite.title : "The Wedding of"}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="font-script text-5xl leading-[1.15] sm:text-6xl md:text-7xl lg:text-8xl"
        >
          <span className="gradient-text animate-shimmer block">
            {primaryName}
          </span>
          <span className="my-3 block font-display text-lg tracking-[0.5em] text-gold/50 sm:text-xl">
            &
          </span>
          <span className="gradient-text animate-shimmer block">
            {secondaryName}
          </span>
        </motion.h1>

        {invite ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-4 max-w-md font-body text-sm text-muted"
          >
            {invite.invite.subtitle}
          </motion.p>
        ) : null}

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.7 }}
          className="mt-8 font-display text-lg tracking-[0.2em] text-cream/90 sm:text-xl"
        >
          {invite ? (
            invite.invite.heroDates
          ) : (
            <>
              12<sup className="text-sm">th</sup> & 13
              <sup className="text-sm">th</sup> August 2026
            </>
          )}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-3 font-body text-sm text-muted"
        >
          {place}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-6 font-script text-2xl text-gold-soft/90"
        >
          {wedding.hashtag}
        </motion.p>

        <motion.a
          href="#countdown"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.25 }}
          className="mt-12 font-body text-[11px] uppercase tracking-[0.35em] text-gold/70 transition hover:text-gold"
        >
          Scroll to explore
          <span className="mt-3 mx-auto block h-8 w-px bg-gradient-to-b from-gold/60 to-transparent animate-pulse-glow" />
        </motion.a>
      </div>

      <div className="absolute bottom-8 right-6 z-20 sm:bottom-10 sm:right-10">
        <MusicToggle />
      </div>
    </section>
  );
}
