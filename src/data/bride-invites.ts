import type { EventIcon, ManagedEvent } from "@/lib/types";

export type BrideInviteTier = "mehfil" | "laavan";

export type BrideInvite = {
  slug: string;
  tier: BrideInviteTier;
  /** Short label for dashboard badges */
  label: string;
  title: string;
  subtitle: string;
  heroDates: string;
  heroPlace: string;
  countdownTarget: string;
  venueSubtitle: string;
  blessings: string;
  rsvpFamilies: Array<{ name: string; side: "bride" | "groom" }>;
  eventIds: string[];
};

/** Bride-side events from the invitation cards (not the main / timeline). */
export const brideEvents: ManagedEvent[] = [
  {
    id: "bride-sukhmani",
    name: "Sukhmani Sahib Path",
    date: "9th August 2026",
    day: "Sunday",
    time: "11:00 AM – 1:00 PM",
    venue: "Panipat",
    venueDetail: "",
    address: "Panipat, Haryana",
    description: "Sunday · Sukhmani Sahib Path",
    icon: "star" as EventIcon,
  },
  {
    id: "bride-mehndi",
    name: "Mehndi",
    date: "9th August 2026",
    day: "Sunday",
    time: "2:00 PM Onwards",
    venue: "Panipat",
    venueDetail: "",
    address: "Panipat, Haryana",
    description: "Sunday · Mehndi",
    icon: "sparkles" as EventIcon,
  },
  {
    id: "bride-jaggo",
    name: "Jaggo",
    date: "9th August 2026",
    day: "Sunday Night",
    time: "7:00 PM",
    venue: "Panipat",
    venueDetail: "",
    address: "Panipat, Haryana",
    description: "Sunday Night · Jaggo",
    icon: "moon" as EventIcon,
  },
  {
    id: "bride-sangeet",
    name: "Sangeet",
    date: "9th August 2026",
    day: "Sunday Night",
    time: "8:00 PM",
    venue: "Panipat",
    venueDetail: "",
    address: "Panipat, Haryana",
    description: "Sunday Night · Sangeet",
    icon: "sun" as EventIcon,
  },
  {
    id: "bride-haldi",
    name: "Haldi",
    date: "12th August 2026",
    day: "Wednesday Morning",
    time: "9:00 AM",
    venue: "Maple Garden",
    venueDetail: "A Unit of Sukhmani Resort",
    address: "Buria Road, Jagadhri",
    description: "Wednesday Morning · Haldi",
    icon: "sun" as EventIcon,
  },
  {
    id: "bride-chooda",
    name: "Chooda Ceremony",
    date: "12th August 2026",
    day: "Wednesday",
    time: "3:00 PM – 4:00 PM",
    venue: "Maple Garden",
    venueDetail: "A Unit of Sukhmani Resort",
    address: "Buria Road, Jagadhri",
    description: "Wednesday · Chooda Ceremony",
    icon: "sparkles" as EventIcon,
  },
  {
    id: "bride-bharaat",
    name: "Bharaat",
    date: "12th August 2026",
    day: "Wednesday Night",
    time: "8:00 PM Onwards",
    venue: "Maple Garden",
    venueDetail: "A Unit of Sukhmani Resort",
    address: "Buria Road, Jagadhri",
    description: "Wednesday Night · Bharaat",
    icon: "moon" as EventIcon,
  },
  {
    id: "bride-anand-karaj",
    name: "Anand Karaj",
    date: "13th August 2026",
    day: "Thursday Morning",
    time: "9:00 AM Onwards",
    venue: "Gurudwara",
    venueDetail: "",
    address: "Jagadhri, Haryana",
    description: "Thursday Morning · Anand Karaj (Laavan)",
    icon: "heart" as EventIcon,
  },
  {
    id: "bride-doli",
    name: "Doli",
    date: "13th August 2026",
    day: "Thursday",
    time: "After Anand Karaj",
    venue: "Gurudwara",
    venueDetail: "",
    address: "Jagadhri, Haryana",
    description: "Thursday · Doli (Vidai)",
    icon: "star" as EventIcon,
  },
];

const MEHFIL_IDS = [
  "bride-sukhmani",
  "bride-mehndi",
  "bride-jaggo",
  "bride-sangeet",
  "bride-haldi",
  "bride-chooda",
  "bride-bharaat",
  "bride-anand-karaj",
  "bride-doli",
] as const;

const LAAVAN_IDS = [
  "bride-haldi",
  "bride-chooda",
  "bride-bharaat",
  "bride-anand-karaj",
  "bride-doli",
] as const;

const sharedCopy = {
  blessings:
    "With the blessings of Late Sardar Hukum Singh (Dadaji) and Eshwar Kaur (Dadiji) & Late Sardar Tirath Singh (Nanaji) and Jaswant Kaur (Naniji)",
  rsvpFamilies: [
    { name: "Chugh Family", side: "bride" as const },
    { name: "Chhabra Family", side: "groom" as const },
  ],
};

/** Obscure invite slugs — do not link from the public homepage. */
export const brideInvites: BrideInvite[] = [
  {
    slug: "swnt-chugh-mehfil-k7m2",
    tier: "mehfil",
    label: "Mehfil (all)",
    title: "You're invited to all celebrations",
    subtitle:
      "Join us in Panipat and Jagadhri for every joyful function of #Swaneet",
    heroDates: "9th · 12th & 13th August 2026",
    heroPlace: "Panipat · Maple Garden, Jagadhri",
    countdownTarget: "2026-08-09T11:00:00+05:30",
    venueSubtitle: "Panipat, Haryana · Maple Garden, Buria Road, Jagadhri",
    eventIds: [...MEHFIL_IDS],
    ...sharedCopy,
  },
  {
    slug: "swnt-chugh-laavan-p9x4",
    tier: "laavan",
    label: "Laavan (wedding)",
    title: "You're invited to the wedding",
    subtitle:
      "Join us in Jagadhri for Haldi, Chooda, Bharaat, Anand Karaj & Doli",
    heroDates: "12th & 13th August 2026",
    heroPlace: "Maple Garden · Jagadhri, Haryana",
    countdownTarget: "2026-08-12T09:00:00+05:30",
    venueSubtitle: "Maple Garden (A Unit of Sukhmani Resort), Buria Road, Jagadhri",
    eventIds: [...LAAVAN_IDS],
    ...sharedCopy,
  },
];

export function getBrideInvite(slug: string): BrideInvite | null {
  return brideInvites.find((invite) => invite.slug === slug) || null;
}

export function eventsForInvite(invite: BrideInvite): ManagedEvent[] {
  const allowed = new Set(invite.eventIds);
  return brideEvents.filter((event) => allowed.has(event.id));
}

export function isBrideInviteSlug(slug: string): boolean {
  return Boolean(getBrideInvite(slug));
}
