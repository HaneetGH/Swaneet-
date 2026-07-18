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
