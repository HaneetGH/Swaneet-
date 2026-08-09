"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ExternalLink,
  Heart,
  Moon,
  Sparkles,
  Star,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import { wedding } from "@/data/wedding";
import {
  eventDirectionsUrl,
  isEventDone,
  sortEventsByDateTime,
} from "@/lib/datetime";
import type { EventIcon, ManagedEvent } from "@/lib/types";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AddAllToCalendar, AddToCalendar } from "@/components/ui/AddToCalendar";
import { cn } from "@/lib/utils";
import { useInvite } from "@/lib/invite-context";

const icons: Record<EventIcon, typeof Moon> = {
  moon: Moon,
  heart: Heart,
  sun: Sun,
  star: Star,
  sparkles: Sparkles,
};

const fallbackEvents: ManagedEvent[] = sortEventsByDateTime(
  wedding.events.map((event) => ({
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
  })),
);

export function Events() {
  const invite = useInvite();
  const [events, setEvents] = useState<ManagedEvent[]>(
    invite ? invite.events : fallbackEvents,
  );

  useEffect(() => {
    if (invite) {
      setEvents(sortEventsByDateTime(invite.events));
      return;
    }
    let active = true;
    fetch("/api/events")
      .then((res) => res.json())
      .then((data: { events?: ManagedEvent[] }) => {
        if (active && data.events?.length) {
          setEvents(sortEventsByDateTime(data.events));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [invite]);

  return (
    <section id="events" className="section-pad relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-gold/20 to-transparent opacity-40 md:opacity-60"
      />

      <div className="relative mx-auto max-w-5xl">
        <SectionHeading
          eyebrow="Celebrations"
          title="Wedding Events"
          subtitle={
            invite?.invite.venueSubtitle ||
            "Maple Garden (A Unit of Sukhmani Resort), Buria Road, Jagadhri"
          }
        />

        <ol className="relative mx-auto max-w-4xl">
          {/* Timeline spine */}
          <div
            aria-hidden
            className="absolute bottom-2 left-[1.15rem] top-2 w-px bg-gradient-to-b from-gold/50 via-gold/25 to-gold/10 md:left-1/2 md:-translate-x-1/2"
          />

          {events.map((event, i) => {
            const Icon = icons[event.icon] || Heart;
            const isLeft = i % 2 === 0;
            const done = isEventDone(event);

            return (
              <li
                key={event.id}
                className={cn(
                  "relative grid grid-cols-[2.3rem_1fr] gap-x-5 last:pb-0 md:grid-cols-[1fr_2.5rem_1fr] md:gap-x-8",
                  done ? "pb-6 md:pb-8" : "pb-12 md:pb-16",
                )}
              >
                {/* Desktop left content */}
                <motion.div
                  initial={{ opacity: 0, x: -28 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{
                    duration: 0.7,
                    delay: i * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={cn(
                    "hidden md:block",
                    isLeft ? "col-start-1 row-start-1 text-right" : "invisible",
                  )}
                >
                  {isLeft ? (
                    <EventDetails event={event} align="right" done={done} />
                  ) : null}
                </motion.div>

                {/* Node */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{
                    duration: 0.5,
                    delay: i * 0.08 + 0.1,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="relative z-10 col-start-1 row-start-1 flex justify-center self-start md:col-start-2"
                >
                  <div
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full border bg-[#0d0b10]",
                      done
                        ? "border-emerald-400/50 text-emerald-300 shadow-[0_0_20px_-4px_rgba(52,211,153,0.45)]"
                        : "border-gold/45 text-gold shadow-[0_0_24px_-4px_rgba(212,175,55,0.55)]",
                    )}
                    aria-label={done ? `${event.name} — done` : event.name}
                  >
                    {done ? (
                      <Check size={16} strokeWidth={2.5} aria-hidden />
                    ) : (
                      <Icon size={16} aria-hidden />
                    )}
                  </div>
                </motion.div>

                {/* Mobile always + desktop right content */}
                <motion.div
                  initial={{ opacity: 0, x: 28 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{
                    duration: 0.7,
                    delay: i * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className={cn(
                    "col-start-2 row-start-1 md:col-start-3",
                    isLeft && "md:invisible",
                  )}
                >
                  <div className="md:hidden">
                    <EventDetails event={event} align="left" done={done} />
                  </div>
                  <div className="hidden md:block">
                    {!isLeft ? (
                      <EventDetails event={event} align="left" done={done} />
                    ) : null}
                  </div>
                </motion.div>
              </li>
            );
          })}
        </ol>

        <AddAllToCalendar
          events={events.filter((event) => !isEventDone(event))}
        />
      </div>
    </section>
  );
}

function EventDetails({
  event,
  align,
  done,
}: {
  event: ManagedEvent;
  align: "left" | "right";
  done: boolean;
}) {
  // Done events start collapsed; upcoming always show full details.
  const [expanded, setExpanded] = useState(!done);
  const showDetails = !done || expanded;

  return (
    <article
      className={cn(
        "relative transition-opacity",
        done && "opacity-70",
        align === "right" ? "md:pr-2" : "md:pl-2",
      )}
    >
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          align === "right" && "md:justify-end",
        )}
      >
        {event.day ? (
          <p className="font-body text-[10px] uppercase tracking-[0.3em] text-gold/70">
            {event.day}
          </p>
        ) : null}
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.22em] text-emerald-200">
            <Check size={11} strokeWidth={2.5} aria-hidden />
            Done
          </span>
        ) : null}
      </div>

      {done ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className={cn(
            "mt-1.5 flex w-full items-start gap-2 text-left transition hover:opacity-100",
            align === "right" && "md:flex-row-reverse md:text-right",
          )}
        >
          <span className="min-w-0 flex-1">
            <h3
              className={cn(
                "font-display text-xl tracking-wide text-cream/75 line-through decoration-gold/30 sm:text-2xl",
                align === "right" && "md:text-right",
              )}
            >
              {event.name}
            </h3>
            <p
              className={cn(
                "mt-1 font-display text-base text-gold-soft/85",
                align === "right" && "md:text-right",
              )}
            >
              {event.date}
            </p>
          </span>
          <ChevronDown
            size={18}
            aria-hidden
            className={cn(
              "mt-1.5 shrink-0 text-gold/60 transition-transform duration-300",
              expanded && "rotate-180",
            )}
          />
          <span className="sr-only">
            {expanded ? "Collapse event details" : "Expand event details"}
          </span>
        </button>
      ) : (
        <>
          <h3
            className={cn(
              "mt-2 font-display text-2xl tracking-wide text-cream sm:text-3xl",
              align === "right" && "md:text-right",
            )}
          >
            {event.name}
          </h3>
          <p
            className={cn(
              "mt-2 font-display text-lg text-gold-soft",
              align === "right" && "md:text-right",
            )}
          >
            {event.date}
          </p>
        </>
      )}

      <AnimatePresence initial={false}>
        {showDetails ? (
          <motion.div
            key="details"
            initial={done ? { height: 0, opacity: 0 } : false}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <p
              className={cn(
                "mt-1 font-body text-sm tracking-wide text-cream/80",
                align === "right" && "md:text-right",
              )}
            >
              {event.time}
            </p>

            <div
              className={cn(
                "my-4 h-px w-16 bg-gradient-to-r from-gold/50 to-transparent",
                align === "right" && "md:ml-auto md:bg-gradient-to-l",
              )}
            />

            <p
              className={cn(
                "font-display text-base text-cream",
                align === "right" && "md:text-right",
              )}
            >
              {event.venue}
            </p>
            {event.venueDetail ? (
              <p
                className={cn(
                  "mt-1 font-body text-xs text-muted",
                  align === "right" && "md:text-right",
                )}
              >
                {event.venueDetail}
              </p>
            ) : null}
            {event.address ? (
              <p
                className={cn(
                  "mt-1 font-body text-xs text-muted",
                  align === "right" && "md:text-right",
                )}
              >
                {event.address}
              </p>
            ) : null}

            <div
              className={cn(
                "mt-4 flex flex-col gap-3",
                align === "right" && "md:items-end",
              )}
            >
              <a
                href={eventDirectionsUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-1.5 font-body text-xs uppercase tracking-[0.2em] text-gold-soft transition hover:text-gold",
                  done && "opacity-80",
                )}
              >
                Get directions
                <ExternalLink size={12} aria-hidden />
              </a>
              {!done ? <AddToCalendar event={event} align={align} /> : null}
            </div>

            {event.description ? (
              <p
                className={cn(
                  "mt-4 font-body text-sm leading-relaxed text-muted",
                  align === "right" && "md:text-right",
                )}
              >
                {event.description}
              </p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}
