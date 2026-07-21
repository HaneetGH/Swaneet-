import { parseDisplayDate, parseDisplayTime } from "@/lib/datetime";
import type { ManagedEvent } from "@/lib/types";
import { wedding } from "@/data/wedding";

const IST_OFFSET = "+05:30";

export type CalendarEventWindow = {
  title: string;
  description: string;
  location: string;
  /** Local IST wall times as YYYYMMDDTHHMMSS */
  startLocal: string;
  endLocal: string;
  /** UTC for Google Calendar dates= param */
  startUtc: string;
  endUtc: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalStamp(y: number, m: number, d: number, hh: number, mm: number) {
  return `${y}${pad(m)}${pad(d)}T${pad(hh)}${pad(mm)}00`;
}

function toUtcStamp(ms: number) {
  const dt = new Date(ms);
  return (
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}${pad(dt.getUTCSeconds())}Z`
  );
}

function parseIstMs(dateISO: string, timeISO: string): number {
  return Date.parse(`${dateISO}T${timeISO}:00${IST_OFFSET}`);
}

function msToIstParts(ms: number): {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
} {
  // Format in Asia/Kolkata via Intl
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || 0);

  return {
    y: get("year"),
    m: get("month"),
    d: get("day"),
    hh: get("hour"),
    mm: get("minute"),
  };
}

/** Pull start (and optional end) from strings like "11:00 AM – 1:00 PM". */
export function parseEventTimeBounds(time: string): {
  start: string;
  end?: string;
  onwards: boolean;
} {
  const onwards = /onwards/i.test(time);
  const matches = [...time.matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)];
  if (!matches.length) {
    const parsed = parseDisplayTime(time);
    return { start: parsed.time || "12:00", onwards: parsed.onwards };
  }

  const to24 = (match: RegExpMatchArray) => {
    let hour = Number(match[1]);
    const minutes = match[2];
    const meridiem = match[3].toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    return `${pad(hour)}:${minutes}`;
  };

  return {
    start: to24(matches[0]!),
    end: matches[1] ? to24(matches[1]) : undefined,
    onwards,
  };
}

function defaultDurationMinutes(event: Pick<ManagedEvent, "name" | "time">) {
  if (/onwards/i.test(event.time)) return 180;
  if (/anand|karaj|path|sukhmani/i.test(event.name)) return 120;
  if (/brunch|lunch|dinner/i.test(event.name)) return 150;
  return 120;
}

export function buildCalendarWindow(
  event: Pick<
    ManagedEvent,
    "name" | "date" | "time" | "venue" | "venueDetail" | "address" | "description"
  >,
): CalendarEventWindow | null {
  const dateISO = parseDisplayDate(event.date);
  if (!dateISO) return null;

  const bounds = parseEventTimeBounds(event.time);
  if (!bounds.start) return null;

  const startMs = parseIstMs(dateISO, bounds.start);
  if (Number.isNaN(startMs)) return null;

  let endMs = bounds.end
    ? parseIstMs(dateISO, bounds.end)
    : startMs + defaultDurationMinutes(event) * 60_000;

  if (Number.isNaN(endMs) || endMs <= startMs) {
    endMs = startMs + defaultDurationMinutes(event) * 60_000;
  }

  const start = msToIstParts(startMs);
  const end = msToIstParts(endMs);

  const location = [event.venue, event.venueDetail, event.address]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");

  const description = [
    event.description,
    location ? `Venue: ${location}` : "",
    `${wedding.couple.groom.firstName} & ${wedding.couple.bride.firstName} · ${wedding.hashtag}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    title: `${event.name} · ${wedding.hashtag}`,
    description,
    location,
    startLocal: toLocalStamp(start.y, start.m, start.d, start.hh, start.mm),
    endLocal: toLocalStamp(end.y, end.m, end.d, end.hh, end.mm),
    startUtc: toUtcStamp(startMs),
    endUtc: toUtcStamp(endMs),
  };
}

function icsEscape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function foldLine(line: string) {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

export function buildIcsFile(
  events: Array<
    Pick<
      ManagedEvent,
      | "id"
      | "name"
      | "date"
      | "time"
      | "venue"
      | "venueDetail"
      | "address"
      | "description"
    >
  >,
): string | null {
  const windows = events
    .map((event) => {
      const window = buildCalendarWindow(event);
      return window ? { event, window } : null;
    })
    .filter(Boolean) as Array<{
    event: (typeof events)[number];
    window: CalendarEventWindow;
  }>;

  if (!windows.length) return null;

  const stamp = toUtcStamp(Date.now());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Swaneet//Wedding//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:#Swaneet Wedding",
    "X-WR-TIMEZONE:Asia/Kolkata",
  ];

  for (const { event, window } of windows) {
    lines.push(
      "BEGIN:VEVENT",
      foldLine(`UID:${event.id}@swaneet.wedding`),
      foldLine(`DTSTAMP:${stamp}`),
      foldLine(`DTSTART;TZID=Asia/Kolkata:${window.startLocal}`),
      foldLine(`DTEND;TZID=Asia/Kolkata:${window.endLocal}`),
      foldLine(`SUMMARY:${icsEscape(window.title)}`),
      foldLine(`DESCRIPTION:${icsEscape(window.description)}`),
      foldLine(`LOCATION:${icsEscape(window.location)}`),
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function googleCalendarUrl(event: ManagedEvent): string | null {
  const window = buildCalendarWindow(event);
  if (!window) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: window.title,
    dates: `${window.startUtc}/${window.endUtc}`,
    details: window.description,
    location: window.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function safeCalendarFilename(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "swaneet-event"
  );
}
