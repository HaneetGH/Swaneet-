import {
  brideInvites,
  eventsForInvite,
  getBrideInvite,
} from "@/data/bride-invites";
import { isEventDone } from "@/lib/datetime";
import { resolveEntryInviteSite } from "@/lib/rsvp-days";
import { listEvents } from "@/lib/store";
import type { AccommodationRequest, ManagedEvent } from "@/lib/types";

/** Google Maps search URL from venue + address for easy tracking. */
export function eventMapsUrl(
  event: Pick<ManagedEvent, "venue" | "venueDetail" | "address" | "name">,
): string | null {
  const query = [event.venue, event.venueDetail, event.address, event.name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Drop events already finished (marked done or past schedule). */
export function filterUpcomingEvents(events: ManagedEvent[]): ManagedEvent[] {
  return events.filter((event) => !isEventDone(event));
}

/** Plain-text wedding itinerary with full location for each upcoming event. */
export function formatEventsItinerary(events: ManagedEvent[]): string {
  const upcoming = filterUpcomingEvents(events);
  if (!upcoming.length) return "";

  const blocks = upcoming.map((event, index) => {
    const venueLine = [event.venue, event.venueDetail]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" · ");
    const address = event.address?.trim() || "";
    const maps = eventMapsUrl(event);

    return [
      `${index + 1}. ${event.name}`,
      `   When: ${event.day}${event.day && event.date ? ", " : ""}${event.date} · ${event.time}`,
      venueLine ? `   Venue: ${venueLine}` : null,
      address ? `   Location: ${address}` : null,
      maps ? `   Maps: ${maps}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return ["Upcoming wedding itinerary", ...blocks].join("\n\n");
}

/**
 * Events to include on a stay email:
 * - Bride invite guests → their mehfil/laavan schedule
 * - Everyone else → full managed wedding timeline from the dashboard
 * Always excludes events that are already done / past.
 */
export async function resolveEventsForStayEmail(
  stay: Pick<AccommodationRequest, "inviteSite" | "inviteTier" | "inviteSlug">,
): Promise<ManagedEvent[]> {
  const site = resolveEntryInviteSite(stay);
  let events: ManagedEvent[] = [];
  if (site === "mehfil" || site === "laavan") {
    const invite =
      (stay.inviteSlug ? getBrideInvite(stay.inviteSlug) : null) ||
      brideInvites.find((item) => item.tier === site) ||
      null;
    if (invite) events = eventsForInvite(invite);
  } else {
    events = await listEvents();
  }
  return filterUpcomingEvents(events);
}
