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
 * ~80% Sikh / Punjabi voices; a light mix of other communities for warmth.
 * Not stored in the database / not shown in dashboard moderation.
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
