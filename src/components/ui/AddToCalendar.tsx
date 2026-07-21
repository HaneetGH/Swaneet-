"use client";

import { useState } from "react";
import { CalendarPlus, ChevronDown, ExternalLink } from "lucide-react";
import { isEventDone } from "@/lib/datetime";
import {
  buildIcsFile,
  downloadIcs,
  googleCalendarUrl,
  safeCalendarFilename,
} from "@/lib/calendar";
import type { ManagedEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

type AddToCalendarProps = {
  event: ManagedEvent;
  align?: "left" | "right";
  className?: string;
};

/**
 * Clear two-choice calendar save:
 * - Phone / Apple / Outlook → .ics download
 * - Google Calendar → opens Google
 */
export function AddToCalendar({
  event,
  align = "left",
  className,
}: AddToCalendarProps) {
  const [open, setOpen] = useState(false);
  const googleUrl = googleCalendarUrl(event);

  const saveToPhone = () => {
    const ics = buildIcsFile([event]);
    if (!ics) return;
    downloadIcs(safeCalendarFilename(event.name), ics);
    setOpen(false);
  };

  return (
    <div
      className={cn(
        "relative",
        align === "right" && "md:flex md:flex-col md:items-end",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 font-body text-xs uppercase tracking-[0.2em] text-gold-soft transition hover:text-gold",
        )}
      >
        <CalendarPlus size={13} aria-hidden />
        Add to your calendar
        <ChevronDown
          size={12}
          aria-hidden
          className={cn("transition", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div
          className={cn(
            "mt-3 w-full max-w-xs rounded-2xl border border-gold/25 bg-[#141018] p-3 text-left shadow-[0_12px_40px_-16px_rgba(0,0,0,0.8)]",
            align === "right" && "md:ml-auto",
          )}
        >
          <p className="font-body text-[11px] leading-relaxed text-muted">
            Save <span className="text-cream">{event.name}</span> so the date
            and time show up in your phone or Google calendar.
          </p>

          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={saveToPhone}
              className="flex w-full flex-col items-start gap-0.5 rounded-xl border border-gold/20 bg-black/25 px-3 py-2.5 text-left transition hover:border-gold/40 hover:bg-gold/10"
            >
              <span className="font-body text-sm text-cream">
                Save on my phone
              </span>
              <span className="font-body text-[11px] text-muted">
                Apple Calendar, Outlook, Samsung & most phones
              </span>
            </button>

            {googleUrl ? (
              <a
                href={googleUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="flex w-full items-start justify-between gap-2 rounded-xl border border-gold/20 bg-black/25 px-3 py-2.5 text-left transition hover:border-gold/40 hover:bg-gold/10"
              >
                <span>
                  <span className="block font-body text-sm text-cream">
                    Open in Google Calendar
                  </span>
                  <span className="mt-0.5 block font-body text-[11px] text-muted">
                    Adds this event in your Google account
                  </span>
                </span>
                <ExternalLink
                  size={12}
                  className="mt-1 shrink-0 text-gold-soft"
                  aria-hidden
                />
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type AddAllToCalendarProps = {
  events: ManagedEvent[];
  className?: string;
};

/** One file with every upcoming event on this page. */
export function AddAllToCalendar({ events, className }: AddAllToCalendarProps) {
  const upcoming = events.filter((event) => !isEventDone(event));

  if (upcoming.length < 2) return null;

  return (
    <div className={cn("mt-10 text-center", className)}>
      <button
        type="button"
        onClick={() => {
          const ics = buildIcsFile(upcoming);
          if (!ics) return;
          downloadIcs("swaneet-all-events", ics);
        }}
        className="inline-flex flex-col items-center gap-1 rounded-2xl border border-gold/25 bg-[#141018] px-5 py-4 transition hover:border-gold/45 hover:bg-gold/10"
      >
        <span className="inline-flex items-center gap-2 font-body text-xs uppercase tracking-[0.22em] text-gold-soft">
          <CalendarPlus size={14} aria-hidden />
          Save all events
        </span>
        <span className="max-w-xs font-body text-[11px] leading-relaxed text-muted">
          Downloads one calendar file with every celebration on this page (
          {upcoming.length} events)
        </span>
      </button>
    </div>
  );
}
