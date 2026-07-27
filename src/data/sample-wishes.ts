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
 * Not stored in the database / not shown in dashboard moderation.
 */
export const SAMPLE_WISHES: SampleWish[] = [
  {
    id: "sample-wish-01",
    body: `May Waheguru bless ${bride} and ${groom} with a lifetime of laughter, faith, and endless chai together.`,
    displayName: "Gurpreet Kaur",
    daysAgo: 1,
  },
  {
    id: "sample-wish-02",
    body: `Two families, one beautiful beginning. So happy for #Swaneet — can't wait to celebrate with you both!`,
    displayName: "Amanjot Singh",
    daysAgo: 2,
  },
  {
    id: "sample-wish-03",
    body: `"Where there is love, there is life." Watching you two find each other has been pure joy.`,
    displayName: "Navneet",
    daysAgo: 2,
  },
  {
    id: "sample-wish-04",
    body: `${groom}, you found your person — and ${bride}, welcome to the chaos and the hugs. We love you both.`,
    displayName: "Simran & Rohan",
    daysAgo: 3,
  },
  {
    id: "sample-wish-05",
    body: `May your home always be filled with sehaj, seva, and the sound of shared jokes at midnight.`,
    displayName: "Harleen Kaur",
    daysAgo: 4,
  },
  {
    id: "sample-wish-06",
    body: `From mehndi giggles to laavan vows — wishing you a marriage as bright as #Swaneet.`,
    displayName: "Jasleen",
    daysAgo: 5,
  },
  {
    id: "sample-wish-07",
    body: `"Grow old along with me; the best is yet to be." So proud of you both.`,
    displayName: "Uncle Ravi",
    daysAgo: 5,
  },
  {
    id: "sample-wish-08",
    body: `Hugs from afar! May every chapter after August be sweeter than the last.`,
    displayName: "Pooja Sharma",
    daysAgo: 6,
  },
  {
    id: "sample-wish-09",
    body: `${bride} and ${groom}, may your love stay soft on hard days and playful on ordinary ones.`,
    displayName: "Manpreet Singh",
    daysAgo: 7,
  },
  {
    id: "sample-wish-10",
    body: `Blessings for a home where music plays, doors stay open, and hearts stay kind. #Swaneet forever!`,
    displayName: "The Gill Family",
    daysAgo: 8,
  },
  {
    id: "sample-wish-11",
    body: `"In all the world, there is no heart for me like yours." Congratulations to the beautiful couple.`,
    displayName: "Ananya",
    daysAgo: 9,
  },
  {
    id: "sample-wish-12",
    body: `Can't wait to dance at your wedding dinner. Love you both — see you soon!`,
    displayName: "Karanjeet",
    daysAgo: 10,
  },
];

/** Keep the wall looking lively until this many real approved wishes exist. */
export const MIN_PUBLIC_WISH_COUNT = 10;

export function sampleWishCreatedAt(daysAgo: number, now = Date.now()) {
  return new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

type PublicWish = {
  id: string;
  body: string;
  displayName: string;
  createdAt: string;
};

/** Merge real approved wishes with sample fillers for social proof. */
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
  }));

  if (real.length >= minCount) {
    return [...real].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  const needed = minCount - real.length;
  const fillers = samples.slice(0, Math.max(needed, 4));
  const merged = [...real, ...fillers];

  // Interleave a little so the wall doesn't read as "all samples at the bottom"
  const realSorted = [...real].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  if (realSorted.length === 0) {
    return fillers.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  const out: PublicWish[] = [];
  let ri = 0;
  let fi = 0;
  while (ri < realSorted.length || fi < fillers.length) {
    if (ri < realSorted.length) out.push(realSorted[ri++]!);
    if (fi < fillers.length) out.push(fillers[fi++]!);
    if (fi < fillers.length && ri >= realSorted.length) {
      while (fi < fillers.length) out.push(fillers[fi++]!);
    }
  }
  return out.length ? out : merged;
}
