export const wedding = {
  hashtag: "#Swaneet",
  blessing:
    "By the Lord's Grace, one is blessed with the Guru and divine union",
  couple: {
    groom: {
      name: "Haneet Singh",
      firstName: "Haneet",
      parents: "Sdn. Ravinder Kaur Chhabra & S. Paramjeet Singh Chhabra",
      family: "Chhabra",
    },
    bride: {
      name: "Swarandeep Kaur",
      firstName: "Swarandeep",
      parents:
        "Sdn. Gurmeet Kaur Chugh & S. Gurmeet Singh Chugh of Hiriyur, Karnataka",
      family: "Chugh",
      hometown: "Hiriyur, Karnataka",
    },
  },
  grandparents: {
    names: "Late Sdn. Maya Devi & Late S. Ram Singh Chhabra Ji",
    note: "With the blessings of Grand Parents",
  },
  childrenInvite: {
    names: ["Prabhmeet", "Rasneet"],
    poem: [
      "Chote-Chote Dil sade, Chaa Bade Bhaare Ne,",
      "Mamu de Vyah 'ch Aaune Sare de Sare ne!",
      "Prabhmeet te Rasneet tuhanu bulaunde ne,",
      "#Swaneet de vyah 'ch geet gaunde ne!",
    ],
  },
  countdownTarget: "2026-08-12T20:00:00+05:30",
  events: [
    {
      id: "wedding-dinner",
      name: "Wedding Dinner",
      date: "12th August 2026",
      day: "Wednesday Night",
      time: "8:00 PM Onwards",
      venue: "Maple Garden",
      venueDetail: "A Unit of Sukhmani Resort",
      address: "Buria Road, Jagadhri",
      description: "Wednesday Night · Wedding Dinner",
      icon: "moon" as const,
    },
    {
      id: "anand-karaj",
      name: "Anand Karaj",
      date: "13th August 2026",
      day: "Thursday Morning",
      time: "9:00 AM",
      venue: "Gurudwara",
      venueDetail: "",
      address: "Buria Road, Jagadhri",
      description: "Thursday Morning · Anand Karaj",
      icon: "heart" as const,
    },
    {
      id: "brunch",
      name: "Brunch",
      date: "13th August 2026",
      day: "Thursday Morning",
      time: "10:30 AM",
      venue: "Gurudwara",
      venueDetail: "",
      address: "Buria Road, Jagadhri",
      description: "Followed by blessings & departure",
      icon: "sun" as const,
    },
  ],
  venue: {
    name: "Maple Garden",
    detail: "A Unit of Sukhmani Resort",
    address: "Buria Road, Jagadhri",
    fullAddress:
      "Maple Garden (A Unit of Sukhmani Resort), Buria Road, Jagadhri",
    mapQuery: "Maple Garden Sukhmani Resort Buria Road Jagadhri",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Maple+Garden+Sukhmani+Resort+Buria+Road+Jagadhri",
    embedUrl:
      "https://maps.google.com/maps?q=Maple+Garden+Sukhmani+Resort+Buria+Road+Jagadhri&t=&z=15&ie=UTF8&iwloc=&output=embed",
  },
  rsvpFamilies: [
    { name: "Chhabra Family", side: "groom" as const },
    { name: "Makkar Family", side: "groom" as const },
    { name: "Ahuja Family", side: "groom" as const },
    { name: "Arora Family", side: "groom" as const },
  ],
  family: {
    groom: {
      title: "Groom's Family",
      members: [
        {
          role: "Parents",
          names: "Sdn. Ravinder Kaur Chhabra & S. Paramjeet Singh Chhabra",
        },
        {
          role: "Grandparents",
          names: "Late Sdn. Maya Devi & Late S. Ram Singh Chhabra Ji",
        },
      ],
    },
    bride: {
      title: "Bride's Family",
      members: [
        {
          role: "Parents",
          names:
            "Sdn. Gurmeet Kaur Chugh & S. Gurmeet Singh Chugh of Hiriyur, Karnataka",
        },
      ],
    },
  },
  gallery: [] as ReadonlyArray<{
    id: number;
    alt: string;
    aspect: "portrait" | "landscape" | "square";
  }>,
  story: [
    {
      title: "Two Families",
      body: "Haneet Singh, son of Sdn. Ravinder Kaur Chhabra & S. Paramjeet Singh Chhabra, and Swarandeep Kaur, daughter of Sdn. Gurmeet Kaur Chugh & S. Gurmeet Singh Chugh of Hiriyur, Karnataka, unite in the sacred bond of Anand Karaj.",
    },
    {
      title: "Blessings",
      body: "With the blessings of Grand Parents Late Sdn. Maya Devi & Late S. Ram Singh Chhabra Ji, the families cordially invite you to the wedding celebrations.",
    },
    {
      title: "A Joyful Call",
      body: "Prabhmeet and Rasneet invite everyone to their Mamu's wedding — where little hearts carry the biggest wishes, and #Swaneet fills with song.",
    },
  ],
  footer: {
    thankYou:
      "We look forward to celebrating with you and receiving your blessings.",
  },
} as const;

export type WeddingEvent = (typeof wedding.events)[number];
