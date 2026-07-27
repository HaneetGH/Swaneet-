import { wedding } from "@/data/wedding";
import type { GuestMessage } from "@/lib/types";

export type SampleWish = {
  id: string;
  body: string;
  displayName: string;
  /** Days ago relative to now — keeps the wall feeling recent */
  daysAgo: number;
};

const bride = wedding.couple.bride.firstName;
const groom = wedding.couple.groom.firstName;

/** Stable auth uid for seeded sample wishes in the database. */
export const SAMPLE_WISH_AUTH_UID = "system:sample";

/**
 * Seed catalog for social-proof wishes.
 * These are written into `guest_messages` (or local store) as approved rows —
 * the public page always reads wishes from the DB, never from this array at render time.
 */
export const SAMPLE_WISHES: SampleWish[] = [
  // —— Sikh / Punjabi (~80%) ——
  {
    id: "sample-wish-01",
    body: `May Waheguru bless ${bride} and ${groom} with sehaj, laughter, and a home full of warmth.`,
    displayName: "Gurpreet Kaur",
    daysAgo: 0,
  },
  {
    id: "sample-wish-02",
    body: `${groom} and ${bride}, may your laavan vows bloom into endless chai, jokes, and kindness.`,
    displayName: "Amanjot Singh",
    daysAgo: 0,
  },
  {
    id: "sample-wish-03",
    body: `Two families, one beautiful beginning. Love from Jagadhri with open hearts for #Swaneet.`,
    displayName: "Harleen Kaur",
    daysAgo: 1,
  },
  {
    id: "sample-wish-04",
    body: `Blessings for a home where kirtan, langar, and open doors are never in short supply.`,
    displayName: "Manpreet Singh",
    daysAgo: 1,
  },
  {
    id: "sample-wish-05",
    body: `Waheguru ji ka Khalsa, Waheguru ji ki Fateh — may your marriage stay rooted in seva and joy.`,
    displayName: "Jasleen Kaur",
    daysAgo: 2,
  },
  {
    id: "sample-wish-06",
    body: `${bride}, welcome to the hugs and the chaos. ${groom}, you found your person. We love you both.`,
    displayName: "Navjot Singh",
    daysAgo: 2,
  },
  {
    id: "sample-wish-07",
    body: `May Guru Sahib keep your path soft — health, harmony, and a lifetime of shared prasad.`,
    displayName: "Simran Kaur",
    daysAgo: 3,
  },
  {
    id: "sample-wish-08",
    body: `From one Punjabi heart to another — may your doli journey turn into a forever of dancing.`,
    displayName: "Gurkirat Singh",
    daysAgo: 3,
  },
  {
    id: "sample-wish-09",
    body: `Sat Sri Akal! Wishing #Swaneet a marriage as bright as the jago and as steady as your faith.`,
    displayName: "Amrit Kaur",
    daysAgo: 4,
  },
  {
    id: "sample-wish-10",
    body: `May your home smell of pinni and love, and may every morning begin with a shared smile.`,
    displayName: "Balwinder Singh",
    daysAgo: 4,
  },
  {
    id: "sample-wish-11",
    body: `${bride} and ${groom}, may Ardas always find you together — in hard days and in happy ones.`,
    displayName: "Pawanpreet Kaur",
    daysAgo: 5,
  },
  {
    id: "sample-wish-12",
    body: `Balle balle for the couple! May your life be filled with bhangra, blessings, and big family hugs.`,
    displayName: "Harbhajan Singh",
    daysAgo: 5,
  },
  // —— Other communities (~20%) ——
  {
    id: "sample-wish-13",
    body: `Shubh vivah! May Lakshmi and Vishnu keep your life abundant, peaceful, and full of love.`,
    displayName: "Ananya Sharma",
    daysAgo: 6,
  },
  {
    id: "sample-wish-14",
    body: `From Chennai with love — may your life together be as sweet as payasam and as strong as family.`,
    displayName: "Divya Krishnan",
    daysAgo: 6,
  },
  {
    id: "sample-wish-15",
    body: `"Grow old along with me; the best is yet to be." So proud of you both.`,
    displayName: "Rohan Mehta",
    daysAgo: 7,
  },
];

export function sampleWishCreatedAt(daysAgo: number, now = Date.now()) {
  return new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

export type PublicWish = {
  id: string;
  body: string;
  displayName: string;
  createdAt: string;
  source?: "guest" | "sample";
};

export function isSampleWishId(id: string) {
  return id.startsWith("sample-wish-");
}

export function isSampleWish(wish: {
  id: string;
  source?: string;
  authUid?: string;
}) {
  return (
    wish.source === "sample" ||
    wish.authUid === SAMPLE_WISH_AUTH_UID ||
    isSampleWishId(wish.id)
  );
}

/** Keep person-written wishes ahead of seeded samples for public render. */
export function preferRealWishes<T extends { id: string; source?: string }>(
  wishes: T[],
): T[] {
  const real = wishes.filter((wish) => !isSampleWish(wish));
  return real.length > 0 ? real : wishes;
}

/** Convert the seed catalog into approved DB-ready guest message rows. */
export function buildSampleGuestMessages(now = Date.now()): GuestMessage[] {
  return SAMPLE_WISHES.map((item) => ({
    id: item.id,
    body: item.body,
    displayName: item.displayName,
    authUid: SAMPLE_WISH_AUTH_UID,
    status: "approved" as const,
    source: "sample" as const,
    inviteSite: "main" as const,
    createdAt: sampleWishCreatedAt(item.daysAgo, now),
    moderatedAt: sampleWishCreatedAt(item.daysAgo, now),
    moderatedBy: "system:seed",
  }));
}

/** Map DB guest messages to the public API shape (already stored — no hardcoded merge). */
export function toPublicWishes(messages: GuestMessage[]): PublicWish[] {
  return messages.map((item) => ({
    id: item.id,
    body: item.body,
    displayName: item.displayName,
    createdAt: item.createdAt,
    source: item.source || (isSampleWish(item) ? "sample" : "guest"),
  }));
}
