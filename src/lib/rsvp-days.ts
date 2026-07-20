import { eventsForInvite, getBrideInvite, brideInvites } from "@/data/bride-invites";
import { wedding } from "@/data/wedding";
import { parseDisplayDate } from "@/lib/datetime";
import type { FeatureSite, RsvpDayResponse } from "@/lib/types";
import type { ManagedEvent } from "@/lib/types";

export type RsvpDayOption = {
  dateKey: string;
  date: string;
  label: string;
  eventNames: string[];
};

function uniqueDaysFromEvents(events: ManagedEvent[]): RsvpDayOption[] {
  const byKey = new Map<string, RsvpDayOption>();
  for (const event of events) {
    const dateKey = parseDisplayDate(event.date) || event.date;
    const existing = byKey.get(dateKey);
    if (existing) {
      if (!existing.eventNames.includes(event.name)) {
        existing.eventNames.push(event.name);
      }
      continue;
    }
    byKey.set(dateKey, {
      dateKey,
      date: event.date,
      label: event.day || event.date,
      eventNames: [event.name],
    });
  }
  return [...byKey.values()].sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey),
  );
}

/** Calendar days a guest can RSVP for on this invite surface. */
export function rsvpDaysForSite(
  site: FeatureSite,
  mainEvents?: ManagedEvent[],
): RsvpDayOption[] {
  if (site === "main") {
    const events =
      mainEvents && mainEvents.length
        ? mainEvents
        : wedding.events.map((event) => ({
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
    return uniqueDaysFromEvents(events);
  }

  const invite = brideInvites.find((item) => item.tier === site);
  if (!invite) return [];
  return uniqueDaysFromEvents(eventsForInvite(invite));
}

export function inviteSiteFromPayload(input?: {
  inviteTier?: "mehfil" | "laavan";
  inviteSide?: "bride" | "groom";
  inviteSite?: FeatureSite;
}): FeatureSite {
  if (input?.inviteSite === "main" || input?.inviteSite === "mehfil" || input?.inviteSite === "laavan") {
    return input.inviteSite;
  }
  if (input?.inviteTier === "mehfil") return "mehfil";
  if (input?.inviteTier === "laavan") return "laavan";
  return "main";
}

/** Bride invite pages share one RSVP; main/guy stays separate. */
export function isBrideFeatureSite(site: FeatureSite): boolean {
  return site === "mehfil" || site === "laavan";
}

export function resolveEntryInviteSite(entry: {
  inviteSite?: FeatureSite;
  inviteTier?: "mehfil" | "laavan";
}): FeatureSite {
  if (
    entry.inviteSite === "main" ||
    entry.inviteSite === "mehfil" ||
    entry.inviteSite === "laavan"
  ) {
    return entry.inviteSite;
  }
  if (entry.inviteTier === "mehfil" || entry.inviteTier === "laavan") {
    return entry.inviteTier;
  }
  return "main";
}

/** Same guest RSVP matches: exact site, or either female card. */
export function inviteSitesShareRsvp(
  stored: FeatureSite,
  requested: FeatureSite,
): boolean {
  if (stored === requested) return true;
  return isBrideFeatureSite(stored) && isBrideFeatureSite(requested);
}

/** Incoming day answers overwrite the same dateKey; other days are kept. */
export function mergeDayResponses(
  existing: RsvpDayResponse[] | undefined,
  incoming: RsvpDayResponse[] | undefined,
): RsvpDayResponse[] {
  const byKey = new Map<string, RsvpDayResponse>();
  for (const day of existing || []) {
    if (!day?.dateKey) continue;
    byKey.set(day.dateKey, day);
  }
  for (const day of incoming || []) {
    if (!day?.dateKey) continue;
    byKey.set(day.dateKey, day);
  }
  return [...byKey.values()].sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey),
  );
}

export function deriveOverallAttendance(
  days: Array<{ attendance: "yes" | "no" | "maybe" }>,
): "yes" | "no" | "maybe" {
  if (!days.length) return "yes";
  if (days.some((d) => d.attendance === "yes")) return "yes";
  if (days.some((d) => d.attendance === "maybe")) return "maybe";
  return "no";
}

export function siteLabel(site: FeatureSite) {
  if (site === "mehfil") return "Bride · Mehfil";
  if (site === "laavan") return "Bride · Laavan";
  return "Main site";
}

/** Resolve slug helper used by APIs */
export function inviteSlugForSite(site: FeatureSite) {
  if (site === "main") return undefined;
  return getBrideInvite(
    site === "mehfil" ? "swnt-chugh-mehfil-k7m2" : "swnt-chugh-laavan-p9x4",
  )?.slug;
}
