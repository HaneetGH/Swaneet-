const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function ordinal(n: number) {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

export function formatDisplayDate(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${ordinal(d)} ${MONTHS[m - 1]} ${y}`;
}

export function formatDayLabel(isoDate: string, period: "morning" | "night" | "none" = "none") {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return "";
  const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  if (period === "morning") return `${weekday} Morning`;
  if (period === "night") return `${weekday} Night`;
  return weekday;
}

export function formatDisplayTime(time24: string, onwards = false) {
  const [hRaw, mRaw] = time24.split(":").map(Number);
  if (Number.isNaN(hRaw) || Number.isNaN(mRaw)) return time24;
  const period = hRaw >= 12 ? "PM" : "AM";
  const hour12 = hRaw % 12 || 12;
  const minutes = String(mRaw).padStart(2, "0");
  const base = `${hour12}:${minutes} ${period}`;
  return onwards ? `${base} Onwards` : base;
}

export function parseDisplayDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const match = value.match(
    /(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/,
  );
  if (!match) return "";

  const day = Number(match[1]);
  const monthIndex = MONTHS.findIndex(
    (month) => month.toLowerCase() === match[2].toLowerCase(),
  );
  const year = Number(match[3]);
  if (monthIndex < 0 || !day || !year) return "";

  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDisplayTime(value: string): {
  time: string;
  onwards: boolean;
} {
  const onwards = /onwards/i.test(value);
  const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) {
    if (/^\d{2}:\d{2}$/.test(value)) return { time: value, onwards };
    return { time: "", onwards };
  }

  let hour = Number(match[1]);
  const minutes = match[2];
  const meridiem = match[3].toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;

  return {
    time: `${String(hour).padStart(2, "0")}:${minutes}`,
    onwards,
  };
}

export function detectPeriod(dayLabel: string): "morning" | "night" | "none" {
  if (/morning/i.test(dayLabel)) return "morning";
  if (/night/i.test(dayLabel)) return "night";
  return "none";
}

export type TimeParts = {
  hour: string;
  minute: string;
  meridiem: "AM" | "PM";
};

export function timeISOToParts(timeISO: string): TimeParts {
  if (!/^\d{2}:\d{2}$/.test(timeISO)) {
    return { hour: "12", minute: "00", meridiem: "AM" };
  }

  const [hRaw, mRaw] = timeISO.split(":").map(Number);
  const meridiem = hRaw >= 12 ? "PM" : "AM";
  const hour12 = hRaw % 12 || 12;

  return {
    hour: String(hour12),
    minute: String(mRaw).padStart(2, "0"),
    meridiem,
  };
}

export function partsToTimeISO(parts: TimeParts): string {
  let hour = Number(parts.hour) % 12;
  if (parts.meridiem === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${parts.minute.padStart(2, "0")}`;
}

export const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

/** Sort key from display date + time strings (earlier first). */
export function eventSortKey(date: string, time: string): number {
  const dateISO = parseDisplayDate(date);
  const { time: timeISO } = parseDisplayTime(time);
  if (!dateISO) return Number.MAX_SAFE_INTEGER;

  const [y, m, d] = dateISO.split("-").map(Number);
  const [hh, mm] = (timeISO || "00:00").split(":").map(Number);
  const stamp = Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  return Number.isNaN(stamp) ? Number.MAX_SAFE_INTEGER : stamp;
}

export function sortEventsByDateTime<T extends { date: string; time: string }>(
  events: T[],
): T[] {
  return [...events].sort(
    (a, b) => eventSortKey(a.date, a.time) - eventSortKey(b.date, b.time),
  );
}

/** True when the event's date+time has passed (India / IST). */
export function isEventInPast(event: { date: string; time: string }): boolean {
  const dateISO = parseDisplayDate(event.date);
  const { time: timeISO } = parseDisplayTime(event.time);
  if (!dateISO) return false;

  const time = timeISO || "23:59";
  const eventMs = Date.parse(`${dateISO}T${time}:00+05:30`);
  if (Number.isNaN(eventMs)) return false;
  return eventMs < Date.now();
}

/** Done if explicitly marked, otherwise when the scheduled time has passed. */
export function isEventDone(event: {
  date: string;
  time: string;
  done?: boolean;
}): boolean {
  if (event.done === true) return true;
  if (event.done === false) return false;
  return isEventInPast(event);
}
