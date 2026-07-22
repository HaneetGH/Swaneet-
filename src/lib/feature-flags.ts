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
  ];

/** Most features on; face find stays off until you enable it. */
const ALL_ON: SiteFeatureFlags = {
  rsvp: true,
  accommodation: true,
  gallery: true,
  guest_photos: true,
  stay_banner: true,
  face_find: false,
};

export function defaultFeatureFlags(): FeatureFlags {
  return {
    main: { ...ALL_ON },
    mehfil: { ...ALL_ON },
    laavan: { ...ALL_ON },
  };
}

export function normalizeFeatureFlags(
  raw: Partial<FeatureFlags> | undefined,
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
