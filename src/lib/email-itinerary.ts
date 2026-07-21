import {
  brideInvites,
  eventsForInvite,
  getBrideInvite,
} from "@/data/bride-invites";
import { resolveEntryInviteSite } from "@/lib/rsvp-days";
import { listEvents } from "@/lib/store";
import type { AccommodationRequest, ManagedEvent } from "@/lib/types";

/** Google Maps search URL from venue + address for easy tracking. */
export function eventMapsUrl(event: Pick<ManagedEvent, "venue" | "venueDetail" | "address" | "name">): string | null {
  const query = [event.venue, event.venueDetail, event.address, event.name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Plain-text wedding itinerary with full location for each event. */
export function formatEventsItinerary(events: ManagedEvent[]): string {
  if (!events.length) return "";

  const blocks = events.map((event, index) => {
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

  return ["Wedding itinerary (with locations)", ...blocks].join("\n\n");
}

/**
 * Events to include on a stay email:
 * - Bride invite guests → their mehfil/laavan schedule
 * - Everyone else → full managed wedding timeline from the dashboard
 */
export async function resolveEventsForStayEmail(
  stay: Pick<AccommodationRequest, "inviteSite" | "inviteTier" | "inviteSlug">,
): Promise<ManagedEvent[]> {
  const site = resolveEntryInviteSite(stay);
  if (site === "mehfil" || site === "laavan") {
    const invite =
      (stay.inviteSlug ? getBrideInvite(stay.inviteSlug) : null) ||
      brideInvites.find((item) => item.tier === site) ||
      null;
    if (invite) return eventsForInvite(invite);
  }
  return listEvents();
}
