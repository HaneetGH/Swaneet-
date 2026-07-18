"use client";

import { Heart, Moon, Sparkles, Star, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { wedding } from "@/data/wedding";
import type { EventIcon, ManagedEvent } from "@/lib/types";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";

const icons: Record<EventIcon, typeof Moon> = {
  moon: Moon,
  heart: Heart,
  sun: Sun,
  star: Star,
  sparkles: Sparkles,
};

const fallbackEvents: ManagedEvent[] = wedding.events.map((event) => ({
  id: event.id,
  name: event.name,
  date: event.date,
  day: event.day,
  time: event.time,
  venue: event.venue,
  venueDetail: event.venueDetail,
  address: event.address,
  description: event.description,
  icon: event.icon,
}));

export function Events() {
  const [events, setEvents] = useState<ManagedEvent[]>(fallbackEvents);

  useEffect(() => {
    let active = true;
    fetch("/api/events")
      .then((res) => res.json())
      .then((data: { events?: ManagedEvent[] }) => {
        if (active && data.events?.length) setEvents(data.events);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <section id="events" className="section-pad relative">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Celebrations"
          title="Wedding Events"
          subtitle="Join us for these ceremonies at Maple Garden"
        />

        <div className="grid gap-6 md:grid-cols-3">
          {events.map((event, i) => {
            const Icon = icons[event.icon] || Heart;
            return (
              <GlassCard
                key={event.id}
                glow
                transition={{
                  duration: 0.7,
                  delay: i * 0.1,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="flex flex-col"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-gold/30 bg-gold/10 text-gold">
                  <Icon size={20} aria-hidden />
                </div>
                <div className="mb-4 inline-flex self-start rounded-sm border border-gold/40 bg-maroon/40 px-3 py-1">
                  <span className="font-display text-sm tracking-wide text-gold-soft">
                    {event.name}
                  </span>
                </div>
                {event.day ? (
                  <p className="font-body text-xs uppercase tracking-[0.25em] text-muted">
                    {event.day}
                  </p>
                ) : null}
                <p className="mt-2 font-display text-xl text-cream">
                  {event.date}
                </p>
                <p className="mt-1 font-body text-sm text-gold-soft">
                  {event.time}
                </p>
                <div className="my-5 h-px w-full bg-gradient-to-r from-gold/40 via-gold/10 to-transparent" />
                <p className="font-display text-base text-cream">
                  {event.venue}
                </p>
                {event.venueDetail ? (
                  <p className="mt-1 font-body text-xs text-muted">
                    {event.venueDetail}
                  </p>
                ) : null}
                {event.address ? (
                  <p className="mt-1 font-body text-xs text-muted">
                    {event.address}
                  </p>
                ) : null}
                {event.description ? (
                  <p className="mt-5 font-body text-sm leading-relaxed text-muted">
                    {event.description}
                  </p>
                ) : null}
              </GlassCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}
