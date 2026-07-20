import { brideInvites } from "@/data/bride-invites";
import type { AccommodationRequest, RsvpEntry } from "@/lib/types";

export type InviteSourceInfo = {
  side?: "bride" | "groom";
  tier?: "mehfil" | "laavan";
  slug?: string;
};

/** Short badge text for dashboard chips */
export function inviteSourceBadge(info: InviteSourceInfo | null | undefined) {
  if (!info?.tier && !info?.side) return "Main site";
  if (info.tier === "mehfil") return "Bride · Mehfil (all)";
  if (info.tier === "laavan") return "Bride · Laavan (wedding)";
  if (info.side === "bride") return "Bride invite";
  if (info.side === "groom") return "Groom / main";
  return "Main site";
}

/** Longer line for lists */
export function inviteSourceDetail(info: InviteSourceInfo | null | undefined) {
  if (!info?.tier && !info?.slug) {
    return "Came from: Main wedding site (/)";
  }
  const invite = info.slug
    ? brideInvites.find((item) => item.slug === info.slug)
    : undefined;
  if (info.tier === "mehfil") {
    return `Came from: Bride all-functions invite (/i/${info.slug || invite?.slug || "mehfil"})`;
  }
  if (info.tier === "laavan") {
    return `Came from: Bride wedding-only invite (/i/${info.slug || invite?.slug || "laavan"})`;
  }
  if (info.slug) {
    return `Came from: Invite /i/${info.slug}`;
  }
  return "Came from: Main wedding site (/)";
}

export function sourceFromRsvp(rsvp: Pick<RsvpEntry, "inviteSide" | "inviteTier" | "inviteSlug">) {
  return {
    side: rsvp.inviteSide,
    tier: rsvp.inviteTier,
    slug: rsvp.inviteSlug,
  } satisfies InviteSourceInfo;
}

export function sourceFromStay(
  stay: Pick<AccommodationRequest, "inviteSide" | "inviteTier" | "inviteSlug">,
) {
  return {
    side: stay.inviteSide,
    tier: stay.inviteTier,
    slug: stay.inviteSlug,
  } satisfies InviteSourceInfo;
}

export function sourceBadgeClass(info: InviteSourceInfo | null | undefined) {
  if (info?.tier === "mehfil") {
    return "border-rose-300/35 bg-rose-400/10 text-rose-100";
  }
  if (info?.tier === "laavan") {
    return "border-amber-300/35 bg-amber-400/10 text-amber-100";
  }
  if (info?.side === "bride") {
    return "border-rose-300/30 bg-rose-400/10 text-rose-100";
  }
  return "border-gold/25 bg-gold/10 text-gold-soft";
}
