import { getBrideInvite } from "@/data/bride-invites";
import type {
  FeatureFlags,
  FeatureKey,
  FeatureSite,
  SiteFeatureFlags,
} from "@/lib/types";

export const FEATURE_SITES: Array<{ id: FeatureSite; label: string }> = [
  { id: "main", label: "Main site (/)" },
  { id: "mehfil", label: "Bride · Mehfil (all functions)" },
  { id: "laavan", label: "Bride · Laavan (wedding only)" },
];

export const FEATURE_KEYS: Array<{ id: FeatureKey; label: string; hint: string }> =
  [
    {
      id: "rsvp",
      label: "RSVP form",
      hint: "Guests can submit attendance",
    },
    {
      id: "accommodation",
      label: "Accommodation booking",
      hint: "Stay request inside RSVP and stay forms",
    },
    {
      id: "gallery",
      label: "Gallery viewing",
      hint: "Logged-in guests can open photos",
    },
    {
      id: "guest_photos",
      label: "Guest photo uploads",
      hint: "Share-a-photo section for guests",
    },
    {
      id: "stay_banner",
      label: "Need Accommodation? banner",
      hint: "Homepage / invite shortcut banner",
    },
    {
      id: "face_find",
      label: "Find my photos (face)",
      hint: "Guests upload a selfie to get a private album of photos of them",
    },
    {
      id: "guest_messages",
      label: "Wishes & quotes",
      hint: "Guests post messages for the bride and groom",
    },
    {
      id: "our_story",
      label: "Our Story section",
      hint: "Show Our Journey / Our Story on this site (off by default; turn on in Feature flags)",
    },
    {
      id: "landing",
      label: "Landing scroll",
      hint: "Loading screen + sealed invitation before the home page. Off = guests land on the site directly",
    },
  ];

/** Most features on; face find + Our Story stay off until enabled. */
const BASE_ON: SiteFeatureFlags = {
  rsvp: true,
  accommodation: true,
  gallery: true,
  guest_photos: true,
  stay_banner: true,
  face_find: false,
  guest_messages: true,
  our_story: false,
  landing: true,
};

export function defaultFeatureFlags(): FeatureFlags {
  return {
    main: { ...BASE_ON, our_story: false },
    mehfil: { ...BASE_ON, our_story: false },
    laavan: { ...BASE_ON, our_story: false },
  };
}

export function normalizeFeatureFlags(
  raw:
    | Partial<Record<FeatureSite, Partial<SiteFeatureFlags>>>
    | undefined,
): FeatureFlags {
  const defaults = defaultFeatureFlags();
  const sites: FeatureSite[] = ["main", "mehfil", "laavan"];
  const keys: FeatureKey[] = [
    "rsvp",
    "accommodation",
    "gallery",
    "guest_photos",
    "stay_banner",
    "face_find",
    "guest_messages",
    "our_story",
    "landing",
  ];

  const next = { ...defaults };
  for (const site of sites) {
    const row = raw?.[site];
    next[site] = { ...defaults[site] };
    if (!row || typeof row !== "object") continue;
    for (const key of keys) {
      if (typeof row[key] === "boolean") {
        next[site][key] = row[key];
      }
    }
  }
  return next;
}

export function isFeatureEnabled(
  flags: FeatureFlags,
  site: FeatureSite,
  key: FeatureKey,
): boolean {
  return flags[site]?.[key] !== false;
}

export function featureSiteFromInviteTier(
  tier?: "mehfil" | "laavan" | null,
): FeatureSite {
  if (tier === "mehfil") return "mehfil";
  if (tier === "laavan") return "laavan";
  return "main";
}

/** Resolve feature site from URL (for Providers, outside InviteProvider). */
export function featureSiteFromPathname(
  pathname: string | null | undefined,
): FeatureSite {
  const match = pathname?.match(/^\/i\/([^/]+)/);
  if (!match?.[1]) return "main";
  const invite = getBrideInvite(match[1]);
  return featureSiteFromInviteTier(invite?.tier);
}
