"use client";

import { wedding } from "@/data/wedding";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";

export function Family() {
  return (
    <section id="family" className="section-pad relative">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="With love"
          title="Our Families"
          subtitle="Blessings that brought us to this day"
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard glow>
            <p className="font-body text-[10px] uppercase tracking-[0.35em] text-gold/70">
              {wedding.family.groom.title}
            </p>
            <h3 className="mt-3 font-display text-2xl text-cream sm:text-3xl">
              {wedding.couple.groom.name}
            </h3>
            <div className="mt-8 space-y-5">
              {wedding.family.groom.members.map((m) => (
                <div key={m.role}>
                  <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted">
                    {m.role}
                  </p>
                  <p className="mt-1 font-body text-sm leading-relaxed text-gold-soft md:text-base">
                    {m.names}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-gold/15 pt-6">
              <p className="mb-3 font-body text-[10px] uppercase tracking-[0.25em] text-muted">
                RSVP Families
              </p>
              <ul className="flex flex-wrap gap-2">
                {wedding.rsvpFamilies.map((f) => (
                  <li
                    key={f.name}
                    className="rounded-full border border-gold/25 bg-gold/5 px-3 py-1 font-body text-xs text-cream/90"
                  >
                    {f.name}
                  </li>
                ))}
              </ul>
            </div>
          </GlassCard>

          <GlassCard glow>
            <p className="font-body text-[10px] uppercase tracking-[0.35em] text-gold/70">
              {wedding.family.bride.title}
            </p>
            <h3 className="mt-3 font-display text-2xl text-cream sm:text-3xl">
              {wedding.couple.bride.name}
            </h3>
            <div className="mt-8 space-y-5">
              {wedding.family.bride.members.map((m) => (
                <div key={m.role}>
                  <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted">
                    {m.role}
                  </p>
                  <p className="mt-1 font-body text-sm leading-relaxed text-gold-soft md:text-base">
                    {m.names}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-8 border-t border-gold/15 pt-6">
              <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted">
                {wedding.grandparents.note}
              </p>
              <p className="mt-2 font-body text-sm leading-relaxed text-gold-soft">
                {wedding.grandparents.names}
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </section>
  );
}
