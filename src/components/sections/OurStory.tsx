"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { wedding } from "@/data/wedding";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export function OurStory() {
  const { enabled, ready } = useFeatureFlags();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]);

  if (ready && !enabled("our_story")) return null;

  return (
    <section id="story" ref={ref} className="section-pad relative overflow-hidden">
      <motion.div
        style={{ y }}
        aria-hidden
        className="pointer-events-none absolute -right-20 top-20 h-72 w-72 rounded-full bg-maroon/20 blur-[100px]"
      />
      <motion.div
        style={{ y }}
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-10 h-64 w-64 rounded-full bg-gold/10 blur-[90px]"
      />

      <div className="relative mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Our journey"
          title="Our Story"
          subtitle="A union blessed by family, faith, and love"
        />

        <div className="relative space-y-8 md:space-y-0">
          <div
            aria-hidden
            className="absolute left-4 top-0 hidden h-full w-px bg-gradient-to-b from-transparent via-gold/40 to-transparent md:left-1/2 md:block"
          />

          {wedding.story.map((item, i) => {
            const left = i % 2 === 0;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, x: left ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                className={`relative md:flex md:items-center md:gap-10 ${
                  left ? "md:flex-row" : "md:flex-row-reverse"
                }`}
              >
                <div className="md:w-1/2">
                  <GlassCard className="md:mx-0">
                    <p className="mb-2 font-body text-[10px] uppercase tracking-[0.3em] text-gold/70">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <h3 className="font-display text-2xl text-cream">
                      {item.title}
                    </h3>
                    <p className="mt-3 font-body text-sm leading-relaxed text-muted md:text-base">
                      {item.body}
                    </p>
                  </GlassCard>
                </div>
                <div className="hidden md:block md:w-1/2" />
              </motion.div>
            );
          })}
        </div>

        <GlassCard className="mt-12" glow>
          <p className="mb-4 text-center font-body text-[10px] uppercase tracking-[0.35em] text-gold/70">
            From {wedding.childrenInvite.names.join(" & ")}
          </p>
          <div className="space-y-2 text-center font-script text-xl leading-relaxed text-gold-soft sm:text-2xl">
            {wedding.childrenInvite.poem.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
