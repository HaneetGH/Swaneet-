import { wedding } from "@/data/wedding";

export type SampleWish = {
  id: string;
  body: string;
  displayName: string;
  /** Days ago relative to now — keeps the wall feeling recent */
  daysAgo: number;
};

const bride = wedding.couple.bride.firstName;
const groom = wedding.couple.groom.firstName;

/**
 * Starter wishes shown on the public wall until enough real guest posts exist.
 * Names mix Sikh, Hindu, and South Indian guests for a lively, familiar crowd.
 * Not stored in the database / not shown in dashboard moderation.
 */
export const SAMPLE_WISHES: SampleWish[] = [
  {
    id: "sample-wish-01",
    body: `May Waheguru bless ${bride} and ${groom} with sehaj, laughter, and a home full of warmth.`,
    displayName: "Gurpreet Kaur",
    daysAgo: 0,
  },
  {
    id: "sample-wish-02",
    body: `Shubh vivah! May Lakshmi and Vishnu keep your life abundant, peaceful, and full of love.`,
    displayName: "Ananya Sharma",
    daysAgo: 0,
  },
  {
    id: "sample-wish-03",
    body: `Wishing you both a lifetime of joy — from Karnataka with lots of love for #Swaneet!`,
    displayName: "Priya Nair",
    daysAgo: 1,
  },
  {
    id: "sample-wish-04",
    body: `${groom} and ${bride}, may your laavan vows bloom into endless chai, jokes, and kindness.`,
    displayName: "Amanjot Singh",
    daysAgo: 1,
  },
  {
    id: "sample-wish-05",
    body: `"Where there is love, there is life." Watching you two begin this chapter is pure joy.`,
    displayName: "Rohan Mehta",
    daysAgo: 2,
  },
  {
    id: "sample-wish-06",
    body: `Mangalyam blessing for a marriage as bright as your smiles. Can't wait to celebrate!`,
    displayName: "Lakshmi Iyer",
    daysAgo: 2,
  },
  {
    id: "sample-wish-07",
    body: `Two families, one beautiful beginning. Love from the Chughs and Chhabras' friends forever.`,
    displayName: "Harleen Kaur",
    daysAgo: 3,
  },
  {
    id: "sample-wish-08",
    body: `May Ganesha clear every path ahead — happiness, health, and harmony for #Swaneet.`,
    displayName: "Aditya Verma",
    daysAgo: 3,
  },
  {
    id: "sample-wish-09",
    body: `${bride}, welcome to the hugs and the chaos. ${groom}, you found your person. We love you both.`,
    displayName: "Kavya Reddy",
    daysAgo: 4,
  },
  {
    id: "sample-wish-10",
    body: `"Grow old along with me; the best is yet to be." So proud of you both.`,
    displayName: "Sandeep Joshi",
    daysAgo: 5,
  },
  {
    id: "sample-wish-11",
    body: `Blessings for a home where kirtan, laughter, and open doors are never in short supply.`,
    displayName: "Manpreet Singh",
    daysAgo: 6,
  },
  {
    id: "sample-wish-12",
    body: `From Chennai with love — may your life together be as sweet as payasam and as strong as family.`,
    displayName: "Divya Krishnan",
    daysAgo: 7,
  },
];

/** Keep the wall looking lively until this many real approved wishes exist. */
export const MIN_PUBLIC_WISH_COUNT = 10;

export function sampleWishCreatedAt(daysAgo: number, now = Date.now()) {
  return new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

export type PublicWish = {
  id: string;
  body: string;
  displayName: string;
  createdAt: string;
};

/** Merge real approved wishes with sample fillers — samples stay near the top. */
export function mergePublicWishes(
  real: PublicWish[],
  options?: { minCount?: number; now?: number },
): PublicWish[] {
  const minCount = options?.minCount ?? MIN_PUBLIC_WISH_COUNT;
  const now = options?.now ?? Date.now();
  const samples: PublicWish[] = SAMPLE_WISHES.map((item) => ({
    id: item.id,
    body: item.body,
    displayName: item.displayName,
    createdAt: sampleWishCreatedAt(item.daysAgo, now),
  })).sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const realSorted = [...real].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (realSorted.length >= minCount) {
    return realSorted;
  }

  const needed = Math.max(minCount - realSorted.length, 6);
  const fillers = samples.slice(0, needed);

  if (realSorted.length === 0) {
    return fillers;
  }

  // Samples first (top of wall), then real guest wishes
  return [...fillers, ...realSorted];
}
