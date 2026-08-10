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
import { useEffect, useMemo, useState } from "react";
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
  /** Done events stay collapsed until the guest expands one. */
  const [expandedDoneIds, setExpandedDoneIds] = useState<Set<string>>(
    () => new Set(),
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

  // Keep chronological order; only upcoming events drive the L/R zigzag.
  const layout = useMemo(() => {
    let upcomingIndex = 0;
    return events.map((event) => {
      const done = isEventDone(event);
      const isLeft = done ? true : upcomingIndex++ % 2 === 0;
      return { event, done, isLeft };
    });
  }, [events]);

  const toggleDone = (id: string) => {
    setExpandedDoneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
          <div
            aria-hidden
            className="absolute bottom-2 left-[1.15rem] top-2 w-px bg-gradient-to-b from-gold/50 via-gold/25 to-gold/10 md:left-1/2 md:-translate-x-1/2"
          />

          {layout.map(({ event, done, isLeft }, i) => {
            const Icon = icons[event.icon] || Heart;
            const expanded = !done || expandedDoneIds.has(event.id);

            return (
              <li
                key={event.id}
                className={cn(
                  "relative grid grid-cols-[2.3rem_1fr] gap-x-5 last:pb-0 md:grid-cols-[1fr_2.5rem_1fr] md:gap-x-8",
                  done ? "pb-4 md:pb-5" : "pb-12 md:pb-16",
                )}
              >
                {done ? (
                  <>
                    <TimelineNode done Icon={Icon} name={event.name} />
                    <div className="col-start-2 row-start-1 self-center md:col-start-3 md:pl-2">
                      <CollapsedDoneEvent
                        event={event}
                        expanded={expanded}
                        onToggle={() => toggleDone(event.id)}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, x: -28 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{
                        duration: 0.7,
                        delay: i * 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className={cn(
                        "hidden md:block",
                        isLeft
                          ? "col-start-1 row-start-1 text-right"
                          : "invisible",
                      )}
                    >
                      {isLeft ? (
                        <UpcomingEventDetails event={event} align="right" />
                      ) : null}
                    </motion.div>

                    <TimelineNode done={false} Icon={Icon} name={event.name} />

                    <motion.div
                      initial={{ opacity: 0, x: 28 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-60px" }}
                      transition={{
                        duration: 0.7,
                        delay: i * 0.05,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      className={cn(
                        "col-start-2 row-start-1 md:col-start-3",
                        isLeft && "md:invisible",
                      )}
                    >
                      <div className="md:hidden">
                        <UpcomingEventDetails event={event} align="left" />
                      </div>
                      <div className="hidden md:block">
                        {!isLeft ? (
                          <UpcomingEventDetails event={event} align="left" />
                        ) : null}
                      </div>
                    </motion.div>
                  </>
                )}
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

function TimelineNode({
  done,
  Icon,
  name,
}: {
  done: boolean;
  Icon: typeof Heart;
  name: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 col-start-1 row-start-1 flex justify-center self-start md:col-start-2"
    >
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full border bg-[#0d0b10]",
          done
            ? "h-7 w-7 border-emerald-400/45 text-emerald-300"
            : "border-gold/45 text-gold shadow-[0_0_24px_-4px_rgba(212,175,55,0.55)]",
        )}
        aria-label={done ? `${name} — done` : name}
      >
        {done ? (
          <Check size={14} strokeWidth={2.5} aria-hidden />
        ) : (
          <Icon size={16} aria-hidden />
        )}
      </div>
    </motion.div>
  );
}

/** Done events keep chronological place, collapsed to a compact row. */
function CollapsedDoneEvent({
  event,
  expanded,
  onToggle,
}: {
  event: ManagedEvent;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="opacity-65">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 rounded-lg py-0.5 text-left transition hover:opacity-100"
      >
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 font-body text-[9px] uppercase tracking-[0.18em] text-emerald-200">
          <Check size={10} strokeWidth={2.5} aria-hidden />
          Done
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-base tracking-wide text-cream/70 line-through decoration-gold/25 sm:text-lg">
            {event.name}
          </span>
          <span className="mt-0.5 block font-body text-[11px] text-muted">
            {[event.date, event.time].filter(Boolean).join(" · ")}
          </span>
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            "shrink-0 text-gold/50 transition-transform duration-150",
            expanded && "rotate-180",
          )}
        />
        <span className="sr-only">
          {expanded ? "Collapse event details" : "Expand event details"}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="pb-1 pt-2">
              <div className="mb-3 h-px w-12 bg-gradient-to-r from-gold/40 to-transparent" />
              <p className="font-display text-sm text-cream/90">{event.venue}</p>
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
              <a
                href={eventDirectionsUrl(event)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.2em] text-gold-soft/80 transition hover:text-gold"
              >
                Get directions
                <ExternalLink size={11} aria-hidden />
              </a>
              {event.description ? (
                <p className="mt-3 font-body text-sm leading-relaxed text-muted">
                  {event.description}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

function UpcomingEventDetails({
  event,
  align,
}: {
  event: ManagedEvent;
  align: "left" | "right";
}) {
  return (
    <article
      className={cn(
        "relative",
        align === "right" ? "md:pr-2" : "md:pl-2",
      )}
    >
      {event.day ? (
        <p
          className={cn(
            "font-body text-[10px] uppercase tracking-[0.3em] text-gold/70",
            align === "right" && "md:text-right",
          )}
        >
          {event.day}
        </p>
      ) : null}

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
          className="inline-flex items-center gap-1.5 font-body text-xs uppercase tracking-[0.2em] text-gold-soft transition hover:text-gold"
        >
          Get directions
          <ExternalLink size={12} aria-hidden />
        </a>
        <AddToCalendar event={event} align={align} />
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
    </article>
  );
}
