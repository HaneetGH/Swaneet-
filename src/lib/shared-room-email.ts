import type { AccommodationRequest, RsvpEntry } from "@/lib/types";

function normalizeEmail(value?: string | null): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || undefined;
}

/** RSVPs linked to a stay request (by id or same Google guest). */
export function findLinkedRsvpsForStay(
  stay: AccommodationRequest,
  rsvps: RsvpEntry[],
): RsvpEntry[] {
  const linked: RsvpEntry[] = [];
  const seen = new Set<string>();

  const push = (rsvp: RsvpEntry | undefined) => {
    if (!rsvp || seen.has(rsvp.id)) return;
    seen.add(rsvp.id);
    linked.push(rsvp);
  };

  if (stay.rsvpId) {
    push(rsvps.find((item) => item.id === stay.rsvpId));
  }

  for (const rsvp of rsvps) {
    if (stay.authUid && rsvp.authUid && stay.authUid === rsvp.authUid) {
      push(rsvp);
      continue;
    }
    const stayEmail =
      normalizeEmail(stay.authEmail) || normalizeEmail(stay.email);
    const rsvpEmail =
      normalizeEmail(rsvp.authEmail) || normalizeEmail(rsvp.email);
    if (stayEmail && rsvpEmail && stayEmail === rsvpEmail) {
      push(rsvp);
    }
  }

  return linked;
}

/**
 * Best single notify address for a stay: stay contact first, then linked RSVP.
 */
export function resolveNotifyEmailForStay(
  stay: AccommodationRequest,
  rsvps: RsvpEntry[],
): { email: string; source: "stay" | "rsvp" } | null {
  const stayEmail =
    normalizeEmail(stay.email) || normalizeEmail(stay.authEmail);
  if (stayEmail) return { email: stayEmail, source: "stay" };

  for (const rsvp of findLinkedRsvpsForStay(stay, rsvps)) {
    const rsvpEmail =
      normalizeEmail(rsvp.email) || normalizeEmail(rsvp.authEmail);
    if (rsvpEmail) return { email: rsvpEmail, source: "rsvp" };
  }
  return null;
}

export type SharedRoomEmailRecipient = {
  email: string;
  stay: AccommodationRequest;
  name: string;
  /** Where the address came from */
  source: "stay" | "rsvp";
};

/**
 * Exactly one recipient per stay request in the share (n stays → n emails).
 * Never drops a guest just because another stay uses the same address.
 * Uses stay contact, or linked RSVP email when the stay has none.
 */
export function collectSharedRoomEmailRecipients(
  stays: AccommodationRequest[],
  rsvps: RsvpEntry[],
): SharedRoomEmailRecipient[] {
  const recipients: SharedRoomEmailRecipient[] = [];

  for (const stay of stays) {
    const resolved = resolveNotifyEmailForStay(stay, rsvps);
    if (!resolved) continue;
    recipients.push({
      email: resolved.email,
      stay,
      name: stay.name,
      source: resolved.source,
    });
  }

  return recipients;
}
