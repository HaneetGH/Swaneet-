/** Nights between ISO date strings (checkOut exclusive like hotel nights). */
export function stayNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

/**
 * True when dateKey is a night the guest is in-house
 * (checkIn inclusive, checkOut exclusive — same as hotel nights).
 */
export function stayCoversDate(
  checkIn: string,
  checkOut: string,
  dateKey: string,
): boolean {
  if (!checkIn || !checkOut || !dateKey) return false;
  return checkIn <= dateKey && dateKey < checkOut;
}

export function formatStayDateLabel(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** True when offered stay is shorter than what the guest originally asked for. */
export function isShorterStayOffer(input: {
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  checkIn: string;
  checkOut: string;
}): boolean {
  const requestedIn = input.requestedCheckIn || input.checkIn;
  const requestedOut = input.requestedCheckOut || input.checkOut;
  const asked = stayNights(requestedIn, requestedOut);
  const offered = stayNights(input.checkIn, input.checkOut);
  if (asked <= 0 || offered <= 0) return false;
  return offered < asked;
}
