import { describe, expect, it } from "vitest";
import {
  defaultFeatureFlags,
  featureSiteFromInviteTier,
  isFeatureEnabled,
  normalizeFeatureFlags,
} from "@/lib/feature-flags";
import {
  eventsForInvite,
  getBrideInvite,
  brideInvites,
} from "@/data/bride-invites";
import { isEventDone, isEventInPast, parseDisplayDate } from "@/lib/datetime";
import {
  inviteSourceBadge,
  inviteSourceDetail,
  sourceFromRsvp,
} from "@/lib/invite-source";
import {
  deriveOverallAttendance,
  inviteSiteFromPayload,
  inviteSitesShareRsvp,
  mergeDayResponses,
  rsvpDaysForSite,
} from "@/lib/rsvp-days";
import {
  collectDownloadedMedia,
  galleryImageIdFromDetail,
  mergeDownloadedMedia,
} from "@/lib/guest-downloads";
import {
  createGalleryAccessToken,
  toProxiedGalleryImage,
  verifyGalleryAccessToken,
} from "@/lib/gallery-access";
import {
  buildCalendarWindow,
  parseEventTimeBounds,
} from "@/lib/calendar";
import { computeRoomInventory } from "@/lib/store";
import {
  buildSharedRoomRoommateContacts,
  collectSharedRoomEmailRecipients,
} from "@/lib/shared-room-email";
import type { AccommodationRequest, RsvpEntry, StayHotel } from "@/lib/types";

describe("bride invites", () => {
  it("resolves mehfil and laavan slugs", () => {
    expect(getBrideInvite("swnt-chugh-mehfil-k7m2")?.tier).toBe("mehfil");
    expect(getBrideInvite("swnt-chugh-laavan-p9x4")?.tier).toBe("laavan");
    expect(getBrideInvite("girl")).toBeNull();
    expect(getBrideInvite("swnt-chugh-mehfil")).toBeNull();
  });

  it("mehfil includes 9 Aug events; laavan does not", () => {
    const mehfil = brideInvites.find((i) => i.tier === "mehfil")!;
    const laavan = brideInvites.find((i) => i.tier === "laavan")!;
    const mehfilEvents = eventsForInvite(mehfil);
    const laavanEvents = eventsForInvite(laavan);

    expect(mehfilEvents.some((e) => e.id === "bride-mehndi")).toBe(true);
    expect(mehfilEvents.some((e) => e.id === "bride-sukhmani")).toBe(true);
    expect(laavanEvents.some((e) => e.id === "bride-mehndi")).toBe(false);
    expect(laavanEvents.some((e) => e.id === "bride-haldi")).toBe(true);
    expect(laavanEvents.some((e) => e.id === "bride-anand-karaj")).toBe(true);
    expect(mehfilEvents.length).toBeGreaterThan(laavanEvents.length);
  });
});

describe("feature flags", () => {
  it("defaults all features on", () => {
    const flags = defaultFeatureFlags();
    expect(isFeatureEnabled(flags, "main", "accommodation")).toBe(true);
    expect(isFeatureEnabled(flags, "laavan", "rsvp")).toBe(true);
  });

  it("can disable accommodation for one site only", () => {
    const flags = normalizeFeatureFlags({
      ...defaultFeatureFlags(),
      laavan: {
        ...defaultFeatureFlags().laavan,
        accommodation: false,
      },
    });
    expect(isFeatureEnabled(flags, "laavan", "accommodation")).toBe(false);
    expect(isFeatureEnabled(flags, "mehfil", "accommodation")).toBe(true);
    expect(isFeatureEnabled(flags, "main", "accommodation")).toBe(true);
  });

  it("maps invite tier to feature site", () => {
    expect(featureSiteFromInviteTier("mehfil")).toBe("mehfil");
    expect(featureSiteFromInviteTier("laavan")).toBe("laavan");
    expect(featureSiteFromInviteTier(undefined)).toBe("main");
  });
});

describe("event done status", () => {
  it("marks past events done even when done:false was stored", () => {
    const past = {
      date: "14th April 2026",
      time: "12:00 PM",
      done: false as boolean | undefined,
    };
    expect(parseDisplayDate(past.date)).toBe("2026-04-14");
    expect(isEventInPast(past)).toBe(true);
    expect(isEventDone(past)).toBe(true);
  });

  it("keeps future events upcoming unless marked done", () => {
    const future = {
      date: "12th August 2026",
      time: "8:00 PM Onwards",
    };
    expect(isEventDone(future)).toBe(false);
    expect(isEventDone({ ...future, done: true })).toBe(true);
  });
});

describe("invite source labels", () => {
  it("labels main vs mehfil vs laavan clearly", () => {
    expect(inviteSourceBadge({})).toBe("Main site");
    expect(inviteSourceBadge({ tier: "mehfil", side: "bride" })).toContain(
      "Mehfil",
    );
    expect(inviteSourceBadge({ tier: "laavan", side: "bride" })).toContain(
      "Laavan",
    );
    expect(inviteSourceDetail(sourceFromRsvp({}))).toContain("Main wedding site");
    expect(
      inviteSourceDetail(
        sourceFromRsvp({
          inviteTier: "mehfil",
          inviteSlug: "swnt-chugh-mehfil-k7m2",
          inviteSide: "bride",
        }),
      ),
    ).toContain("all-functions");
  });
});

describe("rsvp days per invite site", () => {
  it("gives mehfil more days than laavan and one answer slot per calendar day", () => {
    const mehfilDays = rsvpDaysForSite("mehfil");
    const laavanDays = rsvpDaysForSite("laavan");
    expect(mehfilDays.length).toBeGreaterThan(laavanDays.length);
    expect(new Set(mehfilDays.map((d) => d.dateKey)).size).toBe(
      mehfilDays.length,
    );
    expect(laavanDays.some((d) => d.dateKey.includes("08-12"))).toBe(true);
  });

  it("derives overall attendance from day replies", () => {
    expect(
      deriveOverallAttendance([
        { attendance: "no" },
        { attendance: "maybe" },
      ]),
    ).toBe("maybe");
    expect(
      deriveOverallAttendance([
        { attendance: "no" },
        { attendance: "yes" },
      ]),
    ).toBe("yes");
    expect(
      deriveOverallAttendance([{ attendance: "no" }, { attendance: "no" }]),
    ).toBe("no");
  });

  it("maps invite payload to site", () => {
    expect(inviteSiteFromPayload({ inviteTier: "mehfil" })).toBe("mehfil");
    expect(inviteSiteFromPayload({ inviteSite: "main" })).toBe("main");
    expect(inviteSiteFromPayload({})).toBe("main");
  });

  it("shares RSVP across bride cards only, not main", () => {
    expect(inviteSitesShareRsvp("mehfil", "laavan")).toBe(true);
    expect(inviteSitesShareRsvp("laavan", "mehfil")).toBe(true);
    expect(inviteSitesShareRsvp("main", "mehfil")).toBe(false);
    expect(inviteSitesShareRsvp("mehfil", "main")).toBe(false);
  });

  it("merges day answers so laavan updates keep mehfil-only days", () => {
    const merged = mergeDayResponses(
      [
        {
          dateKey: "2026-08-09",
          date: "9th August 2026",
          attendance: "yes",
        },
        {
          dateKey: "2026-08-12",
          date: "12th August 2026",
          attendance: "maybe",
        },
      ],
      [
        {
          dateKey: "2026-08-12",
          date: "12th August 2026",
          attendance: "yes",
        },
        {
          dateKey: "2026-08-13",
          date: "13th August 2026",
          attendance: "no",
        },
      ],
    );
    expect(merged.find((d) => d.dateKey === "2026-08-09")?.attendance).toBe(
      "yes",
    );
    expect(merged.find((d) => d.dateKey === "2026-08-12")?.attendance).toBe(
      "yes",
    );
    expect(merged.find((d) => d.dateKey === "2026-08-13")?.attendance).toBe(
      "no",
    );
  });
});

describe("guest download tracking", () => {
  it("parses image ids from activity details", () => {
    expect(
      galleryImageIdFromDetail("invite:swnt-chugh-mehfil-k7m2|img-abc123"),
    ).toBe("img-abc123");
    expect(galleryImageIdFromDetail("photo-99xyz")).toBe("photo-99xyz");
    expect(galleryImageIdFromDetail("invite:swnt-chugh-laavan-p9x4")).toBeNull();
  });

  it("merges and backfills downloaded media", () => {
    const merged = mergeDownloadedMedia(
      [{ imageId: "a", at: "2026-07-01T10:00:00.000Z" }],
      "b",
      "2026-07-02T10:00:00.000Z",
    );
    expect(merged[0]?.imageId).toBe("b");
    expect(merged).toHaveLength(2);

    const collected = collectDownloadedMedia({
      downloadedMedia: [{ imageId: "a", at: "2026-07-01T10:00:00.000Z" }],
      activity: [
        {
          action: "gallery_download",
          at: "2026-07-03T10:00:00.000Z",
          detail: "invite:x|c",
        },
      ],
    });
    expect(collected.map((d) => d.imageId)).toEqual(["c", "a"]);
  });
});

describe("gallery access tokens", () => {
  it("signs and verifies a short-lived access token", () => {
    const token = createGalleryAccessToken("uid-1", "mehfil");
    const claims = verifyGalleryAccessToken(token);
    expect(claims?.uid).toBe("uid-1");
    expect(claims?.site).toBe("mehfil");
    expect(verifyGalleryAccessToken("tampered.token")).toBeNull();
  });

  it("rewrites gallery src to the authenticated proxy", () => {
    const proxied = toProxiedGalleryImage(
      {
        id: "img-1",
        eventId: "e1",
        alt: "test",
        src: "https://example.public.blob.vercel-storage.com/secret.jpg",
        aspect: "square",
        kind: "image",
        status: "approved",
        createdAt: new Date().toISOString(),
      },
      "tok",
    );
    expect(proxied.src).toBe("/api/gallery/file/img-1?access=tok");
    expect(proxied.src.includes("blob.vercel-storage.com")).toBe(false);
  });
});

describe("add to calendar", () => {
  it("parses time ranges and onwards times", () => {
    expect(parseEventTimeBounds("11:00 AM – 1:00 PM")).toEqual({
      start: "11:00",
      end: "13:00",
      onwards: false,
    });
    expect(parseEventTimeBounds("8:00 PM Onwards").start).toBe("20:00");
    expect(parseEventTimeBounds("8:00 PM Onwards").onwards).toBe(true);
  });

  it("builds a calendar window for wedding dinner", () => {
    const window = buildCalendarWindow({
      name: "Wedding Dinner",
      date: "12th August 2026",
      time: "8:00 PM Onwards",
      venue: "Maple Garden",
      venueDetail: "A Unit of Sukhmani Resort",
      address: "Buria Road, Jagadhri",
      description: "Wednesday Night · Wedding Dinner",
    });
    expect(window?.startLocal).toBe("20260812T200000");
    expect(window?.title).toContain("Wedding Dinner");
    expect(window?.location).toContain("Maple Garden");
  });
});

describe("shared room inventory", () => {
  it("counts only 1 room when several confirmed stays share a group", () => {
    const hotel: StayHotel = {
      id: "h1",
      name: "Test Hotel",
      totalRooms: 5,
      createdAt: new Date().toISOString(),
    };
    const base = {
      phone: "999",
      email: "a@b.com",
      rooms: 1,
      checkIn: "2026-08-12",
      checkOut: "2026-08-13",
      createdAt: new Date().toISOString(),
      status: "confirmed" as const,
      hotelId: "h1",
      roomGroupId: "g1",
    };
    const stays: AccommodationRequest[] = [
      {
        ...base,
        id: "1",
        name: "A",
        people: 2,
        roomGroupRole: "primary",
        roomsAssigned: 1,
      },
      {
        ...base,
        id: "2",
        name: "B",
        people: 1,
        roomGroupRole: "member",
        roomsAssigned: 0,
      },
      {
        ...base,
        id: "3",
        name: "C",
        people: 1,
        roomGroupRole: "member",
        roomsAssigned: 0,
      },
    ];
    const inv = computeRoomInventory(stays, [hotel]);
    expect(inv.assigned).toBe(1);
    expect(inv.available).toBe(4);
  });

  it("sends one email per stay request (n requests → n emails)", () => {
    const stays: AccommodationRequest[] = [
      {
        id: "s1",
        name: "Asha",
        phone: "1",
        email: "",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        rsvpId: "r1",
        roomGroupId: "g1",
        roomShareWith: ["Bir"],
      },
      {
        id: "s2",
        name: "Bir",
        phone: "2",
        email: "",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        rsvpId: "r2",
        roomGroupId: "g1",
        roomShareWith: ["Asha"],
      },
    ];
    const rsvps: RsvpEntry[] = [
      {
        id: "r1",
        name: "Asha",
        guests: 1,
        attendance: "yes",
        email: "asha@example.com",
        createdAt: new Date().toISOString(),
      },
      {
        id: "r2",
        name: "Bir",
        guests: 1,
        attendance: "yes",
        email: "bir@example.com",
        createdAt: new Date().toISOString(),
      },
    ];

    const recipients = collectSharedRoomEmailRecipients(stays, rsvps);
    expect(recipients).toHaveLength(2);
    expect(recipients.map((r) => r.name).sort()).toEqual(["Asha", "Bir"]);
    expect(recipients.map((r) => r.email).sort()).toEqual([
      "asha@example.com",
      "bir@example.com",
    ]);
    expect(recipients.every((r) => r.source === "rsvp")).toBe(true);
  });

  it("still sends n emails even if two guests share the same address", () => {
    const stays: AccommodationRequest[] = [
      {
        id: "s1",
        name: "Asha",
        phone: "1",
        email: "family@example.com",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        roomGroupId: "g1",
        roomShareWith: ["Bir"],
      },
      {
        id: "s2",
        name: "Bir",
        phone: "2",
        email: "family@example.com",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        roomGroupId: "g1",
        roomShareWith: ["Asha"],
      },
    ];

    const recipients = collectSharedRoomEmailRecipients(stays, []);
    expect(recipients).toHaveLength(2);
    expect(recipients.map((r) => r.name).sort()).toEqual(["Asha", "Bir"]);
  });

  it("includes roommate phone and email for shared-room emails", () => {
    const stays: AccommodationRequest[] = [
      {
        id: "s1",
        name: "Asha",
        phone: "111",
        email: "asha@example.com",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        roomGroupId: "g1",
      },
      {
        id: "s2",
        name: "Bir",
        phone: "222",
        email: "",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        rsvpId: "r2",
        roomGroupId: "g1",
      },
    ];
    const rsvps: RsvpEntry[] = [
      {
        id: "r2",
        name: "Bir",
        guests: 1,
        attendance: "yes",
        email: "bir@example.com",
        createdAt: new Date().toISOString(),
      },
    ];

    const forAsha = buildSharedRoomRoommateContacts(stays, rsvps, "s1");
    expect(forAsha).toEqual([
      { name: "Bir", phone: "222", email: "bir@example.com" },
    ]);
  });
});
