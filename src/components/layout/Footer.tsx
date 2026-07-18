"use client";

import { motion } from "framer-motion";
import { wedding } from "@/data/wedding";
import { Sparkles } from "@/components/effects/Sparkles";

export function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-gold/15 px-5 py-20 sm:px-8">
      <Sparkles count={12} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(212,175,55,0.08),transparent_55%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="relative mx-auto max-w-2xl text-center"
      >
        <p className="font-body text-[10px] uppercase tracking-[0.4em] text-gold/70">
          With gratitude
        </p>
        <h2 className="mt-4 font-script text-4xl text-gold-soft sm:text-5xl">
          {wedding.couple.groom.firstName} & {wedding.couple.bride.firstName}
        </h2>
        <p className="mx-auto mt-6 max-w-md font-body text-sm leading-relaxed text-muted">
          {wedding.footer.thankYou}
        </p>
        <p className="mt-8 font-script text-2xl text-gold/80">
          {wedding.hashtag}
        </p>

        <svg
          className="mx-auto mt-10 h-8 w-48 text-gold/40"
          viewBox="0 0 200 20"
          fill="none"
          aria-hidden
        >
          <path
            d="M0 10 C40 0, 60 20, 100 10 C140 0, 160 20, 200 10"
            stroke="currentColor"
            strokeWidth="1"
          />
          <circle cx="100" cy="10" r="2.5" fill="currentColor" />
        </svg>

        <p className="mt-8 font-body text-[10px] tracking-[0.25em] text-muted/70">
          Maple Garden (A Unit of Sukhmani Resort) · Buria Road, Jagadhri · August 2026
        </p>
      </motion.div>
    </footer>
  );
}
