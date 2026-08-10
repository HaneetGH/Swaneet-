import { describe, expect, it } from "vitest";
import {
  defaultFeatureFlags,
  featureSiteFromInviteTier,
  featureSiteFromPathname,
  isFeatureEnabled,
  normalizeFeatureFlags,
} from "@/lib/feature-flags";
import {
  absoluteGuestUrl,
  guestActionPath,
  wishesPublicPath,
} from "@/lib/guest-paths";
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
import { formatEventsItinerary, filterUpcomingEvents } from "@/lib/email-itinerary";
import {
  ANNOUNCEMENT_TEST_EMAIL,
  buildAnnouncementEmailParts,
  isMainAnnouncementTestSubject,
  mergeInviteWithManagedOverrides,
  mergeScheduleEvents,
} from "@/lib/announcement-email";
import { buildEventEmailParts } from "@/lib/email-event-template";
import { buildStayConfirmationParts } from "@/lib/email-stay-template";
import { shiftDateKey, sitesForAudienceScope, stayEligibleForDigest } from "@/lib/event-emails";
import { stayCoversDate } from "@/lib/stay-dates";
import {
  audienceScopeLabel,
  isWithinScheduleWindow,
  nextFiringIso,
  normalizeEventEmailJobConfig,
  timeIstToMinutes,
} from "@/lib/event-email-jobs";
import { computeRoomInventory } from "@/lib/store";
import { buildRoomOccupancy, occupancyRoomsHeld } from "@/lib/room-occupancy";
import { isShorterStayOffer, stayNights } from "@/lib/stay-dates";
import {
  buildSharedRoomRoommateContacts,
  collectSharedRoomEmailRecipients,
} from "@/lib/shared-room-email";
import type {
  AccommodationRequest,
  ManagedEvent,
  RsvpEntry,
  StayHotel,
} from "@/lib/types";

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

describe("team role presets", () => {
  it("recognizes the photographer role from gallery permissions only", async () => {
    const {
      PHOTOGRAPHER_PERMISSIONS,
      isPhotographerRole,
      matchTeamRolePreset,
      normalizePermissions,
    } = await import("@/lib/roles");

    expect(PHOTOGRAPHER_PERMISSIONS).toEqual([
      "gallery_upload",
      "gallery_review",
    ]);
    expect(isPhotographerRole(["gallery_review", "gallery_upload"])).toBe(true);
    expect(isPhotographerRole(["gallery_upload"])).toBe(false);
    expect(isPhotographerRole(["gallery_upload", "gallery_review", "rsvp"])).toBe(
      false,
    );
    expect(matchTeamRolePreset(PHOTOGRAPHER_PERMISSIONS)?.id).toBe(
      "photographer",
    );
    expect(normalizePermissions(["gallery"])).toEqual([
      "gallery_upload",
      "gallery_review",
    ]);
  });
});

describe("feature flags", () => {
  it("defaults core features on and face_find off", () => {
    const flags = defaultFeatureFlags();
    expect(isFeatureEnabled(flags, "main", "accommodation")).toBe(true);
    expect(isFeatureEnabled(flags, "laavan", "rsvp")).toBe(true);
    expect(isFeatureEnabled(flags, "main", "face_find")).toBe(false);
    expect(isFeatureEnabled(flags, "mehfil", "face_find")).toBe(false);
    expect(isFeatureEnabled(flags, "main", "our_story")).toBe(true);
    expect(isFeatureEnabled(flags, "mehfil", "our_story")).toBe(false);
    expect(isFeatureEnabled(flags, "laavan", "our_story")).toBe(false);
    expect(isFeatureEnabled(flags, "main", "landing")).toBe(true);
    expect(isFeatureEnabled(flags, "mehfil", "landing")).toBe(true);
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
    expect(featureSiteFromPathname("/")).toBe("main");
    expect(featureSiteFromPathname("/i/swnt-chugh-mehfil-k7m2")).toBe("mehfil");
    expect(featureSiteFromPathname("/i/swnt-chugh-laavan-p9x4/rsvp")).toBe(
      "laavan",
    );
  });

  it("fills missing our_story from defaults when normalizing", () => {
    const flags = normalizeFeatureFlags({
      main: {
        rsvp: true,
        accommodation: true,
        gallery: true,
        guest_photos: true,
        stay_banner: true,
        face_find: false,
        guest_messages: true,
      } as never,
    });
    expect(flags.main.our_story).toBe(true);
    expect(flags.mehfil.our_story).toBe(false);
    expect(flags.main.landing).toBe(true);
  });

  it("can turn off landing scroll so guests skip the sealed invite", () => {
    const flags = normalizeFeatureFlags({
      ...defaultFeatureFlags(),
      main: {
        ...defaultFeatureFlags().main,
        landing: false,
      },
    });
    expect(isFeatureEnabled(flags, "main", "landing")).toBe(false);
    expect(isFeatureEnabled(flags, "mehfil", "landing")).toBe(true);
  });
});

describe("guest paths", () => {
  it("scopes action paths to invite basePath", () => {
    const invite = { basePath: "/i/swnt-chugh-mehfil-k7m2" };
    expect(guestActionPath("/my-account", invite)).toBe(
      "/i/swnt-chugh-mehfil-k7m2/my-account",
    );
    expect(guestActionPath("/my-photos", invite)).toBe(
      "/i/swnt-chugh-mehfil-k7m2/my-photos",
    );
    expect(guestActionPath("/gallery", invite)).toBe(
      "/i/swnt-chugh-mehfil-k7m2/gallery",
    );
    expect(guestActionPath("/wishes", null)).toBe("/wishes");
  });

  it("builds wish public / absolute URLs with invite slug", () => {
    expect(wishesPublicPath("swnt-chugh-laavan-p9x4")).toBe(
      "/i/swnt-chugh-laavan-p9x4/wishes",
    );
    expect(wishesPublicPath(undefined)).toBe("/wishes");
    expect(
      absoluteGuestUrl("/wishes", {
        siteUrl: "https://example.com",
        inviteSlug: "swnt-chugh-mehfil-k7m2",
      }),
    ).toBe("https://example.com/i/swnt-chugh-mehfil-k7m2/wishes");
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

  it("excludes blocked rooms from free inventory", () => {
    const hotel: StayHotel = {
      id: "h1",
      name: "Test Hotel",
      totalRooms: 10,
      blockedRooms: 3,
      createdAt: new Date().toISOString(),
    };
    const stays: AccommodationRequest[] = [
      {
        id: "1",
        name: "A",
        phone: "1",
        email: "a@b.com",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        hotelId: "h1",
        roomsAssigned: 2,
      },
    ];
    const inv = computeRoomInventory(stays, [hotel]);
    expect(inv.assigned).toBe(2);
    expect(inv.blocked).toBe(3);
    expect(inv.available).toBe(5);
    expect(inv.hotels[0]?.blocked).toBe(3);
    expect(inv.hotels[0]?.available).toBe(5);
  });

  it("lists occupancy with shared members under one room unit", () => {
    const hotel: StayHotel = {
      id: "h1",
      name: "Test Hotel",
      totalRooms: 5,
      createdAt: new Date().toISOString(),
    };
    const stays: AccommodationRequest[] = [
      {
        id: "1",
        name: "A",
        phone: "1",
        email: "a@b.com",
        people: 2,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        hotelId: "h1",
        hotelName: "Test Hotel",
        roomsAssigned: 1,
        roomGroupId: "g1",
        roomGroupRole: "primary",
      },
      {
        id: "2",
        name: "B",
        phone: "2",
        email: "b@b.com",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        hotelId: "h1",
        roomsAssigned: 0,
        roomGroupId: "g1",
        roomGroupRole: "member",
      },
      {
        id: "3",
        name: "Solo",
        phone: "3",
        email: "s@b.com",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        hotelId: "h1",
        roomsAssigned: 2,
      },
    ];
    const units = buildRoomOccupancy(stays, [hotel]);
    expect(units).toHaveLength(2);
    const shared = units.find((unit) => unit.roomGroupId === "g1");
    expect(shared?.stays.map((s) => s.name).sort()).toEqual(["A", "B"]);
    expect(shared?.roomsHeld).toBe(1);
    const solo = units.find((unit) => unit.key === "3");
    expect(solo?.roomsHeld).toBe(2);
    expect(solo?.stays).toHaveLength(1);
    expect(occupancyRoomsHeld(units)).toBe(3);
  });

  it("does not list shared groups that hold no inventory rooms", () => {
    const hotel: StayHotel = {
      id: "h1",
      name: "Test Hotel",
      totalRooms: 5,
      createdAt: new Date().toISOString(),
    };
    const stays: AccommodationRequest[] = [
      {
        id: "1",
        name: "Ghost primary",
        phone: "1",
        email: "a@b.com",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        hotelId: "h1",
        roomsAssigned: 0,
        roomGroupId: "ghost",
        roomGroupRole: "primary",
      },
      {
        id: "2",
        name: "Real solo",
        phone: "2",
        email: "b@b.com",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        hotelId: "h1",
        roomsAssigned: 2,
      },
    ];
    const units = buildRoomOccupancy(stays, [hotel]);
    expect(units).toHaveLength(1);
    expect(occupancyRoomsHeld(units)).toBe(2);
    expect(computeRoomInventory(stays, [hotel]).assigned).toBe(2);
  });

  it("counts rooms against the matching hotel when hotelId is missing", () => {
    const hotels: StayHotel[] = [
      {
        id: "oscar",
        name: "The Oscar Regency",
        totalRooms: 15,
        createdAt: new Date().toISOString(),
      },
      {
        id: "deepak",
        name: "Deepak Bakery Rooms",
        totalRooms: 14,
        createdAt: new Date().toISOString(),
      },
    ];
    const stays: AccommodationRequest[] = [
      {
        id: "1",
        name: "A",
        phone: "1",
        email: "a@b.com",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        hotelName: "Deepak Bakery Rooms",
        roomsAssigned: 1,
      },
      {
        id: "2",
        name: "B",
        phone: "2",
        email: "b@b.com",
        people: 1,
        rooms: 1,
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
        createdAt: new Date().toISOString(),
        status: "confirmed",
        hotelId: "deepak",
        hotelName: "Deepak Bakery Rooms",
        roomsAssigned: 1,
      },
    ];
    const inv = computeRoomInventory(stays, hotels);
    expect(inv.assigned).toBe(2);
    expect(inv.hotels.find((h) => h.id === "deepak")?.assigned).toBe(2);
    expect(inv.hotels.find((h) => h.id === "oscar")?.assigned).toBe(0);
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

describe("stay email itinerary", () => {
  it("formats upcoming events with venue, location, and maps link", () => {
    const events: ManagedEvent[] = [
      {
        id: "e1",
        name: "Mehndi",
        date: "9th August 2099",
        day: "Sunday",
        time: "2:00 PM Onwards",
        venue: "Panipat",
        venueDetail: "",
        address: "Panipat, Haryana",
        description: "",
        icon: "sparkles",
      },
      {
        id: "e2",
        name: "Anand Karaj",
        date: "13th August 2099",
        day: "Thursday",
        time: "10:00 AM",
        venue: "Maple Garden",
        venueDetail: "Jagadhri",
        address: "Buria Road, Jagadhri",
        description: "",
        icon: "heart",
      },
    ];
    const text = formatEventsItinerary(events);
    expect(text).toContain("Upcoming wedding itinerary");
    expect(text).toContain("1. Mehndi");
    expect(text).toContain("Venue: Panipat");
    expect(text).toContain("Location: Panipat, Haryana");
    expect(text).toContain("2. Anand Karaj");
    expect(text).toContain("Venue: Maple Garden · Jagadhri");
    expect(text).toContain("Location: Buria Road, Jagadhri");
    expect(text).toContain("Maps: https://www.google.com/maps/search/");
    expect(text).toContain(encodeURIComponent("Maple Garden"));
  });

  it("skips events that are already done", () => {
    const events: ManagedEvent[] = [
      {
        id: "past",
        name: "Old Mehndi",
        date: "9th August 2020",
        day: "Sunday",
        time: "2:00 PM",
        venue: "Panipat",
        venueDetail: "",
        address: "Panipat",
        description: "",
        icon: "sparkles",
        done: true,
      },
      {
        id: "future",
        name: "Anand Karaj",
        date: "13th August 2099",
        day: "Thursday",
        time: "10:00 AM",
        venue: "Maple Garden",
        venueDetail: "",
        address: "Buria Road, Jagadhri",
        description: "",
        icon: "heart",
      },
    ];
    expect(filterUpcomingEvents(events).map((e) => e.id)).toEqual(["future"]);
    const text = formatEventsItinerary(events);
    expect(text).not.toContain("Old Mehndi");
    expect(text).toContain("Anand Karaj");
  });

  it("renders polished wedding HTML for shared-room confirmations", () => {
    const request: AccommodationRequest = {
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
      hotelName: "Maple Garden",
      hotelAddress: "Buria Road, Jagadhri",
      roomGroupId: "g1",
      roomShareWith: ["Bir"],
    };
    const { html, text } = buildStayConfirmationParts({
      request,
      statusLine: "You will share this one room with Bir.",
      isSharedRoom: true,
      roommates: [
        { name: "Bir", phone: "222", email: "bir@example.com" },
      ],
      events: [
        {
          id: "done-event",
          name: "Already done",
          date: "1st January 2020",
          day: "Wednesday",
          time: "10:00 AM",
          venue: "Old place",
          venueDetail: "",
          address: "Somewhere",
          description: "",
          icon: "star",
          done: true,
        },
        {
          id: "live",
          name: "Wedding Dinner",
          date: "12th August 2099",
          day: "Wednesday",
          time: "8:00 PM Onwards",
          venue: "Maple Garden",
          venueDetail: "Sukhmani Resort",
          address: "Buria Road, Jagadhri",
          description: "",
          icon: "moon",
        },
      ],
    });
    expect(html).toContain("#Swaneet");
    expect(html).toContain("Your shared room");
    expect(html).toContain("Your roommates");
    expect(html).toContain("Open in Maps");
    expect(html).toContain("Wedding Dinner");
    expect(html).not.toContain("Already done");
    expect(text).toContain("Bir");
    expect(text).not.toContain("Already done");
  });
});

describe("stay dates / shorter offers", () => {
  it("counts hotel nights between check-in and check-out", () => {
    expect(stayNights("2026-08-11", "2026-08-12")).toBe(1);
    expect(stayNights("2026-08-11", "2026-08-13")).toBe(2);
    expect(stayNights("2026-08-12", "2026-08-12")).toBe(0);
  });

  it("detects when offered nights are fewer than requested", () => {
    expect(
      isShorterStayOffer({
        requestedCheckIn: "2026-08-11",
        requestedCheckOut: "2026-08-13",
        checkIn: "2026-08-12",
        checkOut: "2026-08-13",
      }),
    ).toBe(true);
    expect(
      isShorterStayOffer({
        requestedCheckIn: "2026-08-12",
        requestedCheckOut: "2026-08-13",
        checkIn: "2026-08-11",
        checkOut: "2026-08-13",
      }),
    ).toBe(false);
  });
});

describe("public wishes social proof", () => {
  it("keeps unique real + sample wishes without hiding samples", async () => {
    const {
      buildSampleGuestMessages,
      buildDisplayWishPool,
      toPublicWishes,
      SAMPLE_WISH_AUTH_UID,
    } = await import("@/data/sample-wishes");

    const seeded = buildSampleGuestMessages(
      Date.parse("2026-07-27T12:00:00Z"),
    );
    expect(seeded.length).toBeGreaterThanOrEqual(10);
    expect(
      seeded.every(
        (item) =>
          item.status === "approved" &&
          item.source === "sample" &&
          item.authUid === SAMPLE_WISH_AUTH_UID,
      ),
    ).toBe(true);

    const onlySamples = buildDisplayWishPool(toPublicWishes(seeded));
    expect(onlySamples.every((item) => item.source === "sample")).toBe(true);

    // 1 real (like Rahul) must NOT wipe samples — otherwise hero repeats one wish
    const mixed = buildDisplayWishPool(
      toPublicWishes([
        ...seeded,
        {
          id: "real-1",
          body: "Mubaraka, Mubaraka, Mubaraka",
          displayName: "Rahul",
          authUid: "guest-1",
          status: "approved",
          source: "guest",
          createdAt: "2026-07-20T12:00:00Z",
        },
      ]),
    );
    expect(mixed[0]?.id).toBe("real-1");
    expect(mixed.filter((item) => item.source === "sample").length).toBeGreaterThan(
      5,
    );
    const ids = new Set(mixed.map((item) => item.id));
    expect(ids.size).toBe(mixed.length);

    // Duplicate body text is removed
    const withDup = buildDisplayWishPool(
      toPublicWishes([
        {
          id: "real-1",
          body: "Same blessing text for the couple tonight.",
          displayName: "A",
          authUid: "g1",
          status: "approved",
          source: "guest",
          createdAt: "2026-07-20T12:00:00Z",
        },
        {
          id: "real-2",
          body: "Same blessing text for the couple tonight.",
          displayName: "B",
          authUid: "g2",
          status: "approved",
          source: "guest",
          createdAt: "2026-07-19T12:00:00Z",
        },
        ...seeded.slice(0, 3),
      ]),
    );
    expect(
      withDup.filter((item) =>
        item.body.toLowerCase().includes("same blessing text"),
      ),
    ).toHaveLength(1);

    // 10+ reals → fill primarily with reals
    const manyReal = Array.from({ length: 10 }, (_, i) => ({
      id: `real-${i}`,
      body: `Unique real wish number ${i + 1} for the couple here.`,
      displayName: `Guest ${i + 1}`,
      authUid: `guest-${i}`,
      status: "approved" as const,
      source: "guest" as const,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
    }));
    const filled = buildDisplayWishPool(
      toPublicWishes([...manyReal, ...seeded.slice(0, 2)]),
    );
    expect(filled.every((item) => item.source === "guest")).toBe(true);
    expect(filled).toHaveLength(10);
  });
});

describe("event guest emails", () => {
  it("shifts IST date keys across month boundaries", () => {
    expect(shiftDateKey("2026-08-08", 1)).toBe("2026-08-09");
    expect(shiftDateKey("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDateKey("2026-08-09", -1)).toBe("2026-08-08");
  });

  it("maps digest audience scope to feature sites", () => {
    expect(sitesForAudienceScope("main")).toEqual(["main"]);
    expect(sitesForAudienceScope("bride")).toEqual(["mehfil", "laavan"]);
    expect(sitesForAudienceScope("all")).toEqual(["main", "mehfil", "laavan"]);
    expect(audienceScopeLabel("main")).toMatch(/groom/i);
    expect(audienceScopeLabel("bride")).toMatch(/Mehfil/i);
  });

  it("treats hotel nights as check-in inclusive / check-out exclusive", () => {
    expect(stayCoversDate("2026-08-12", "2026-08-14", "2026-08-12")).toBe(true);
    expect(stayCoversDate("2026-08-12", "2026-08-14", "2026-08-13")).toBe(true);
    expect(stayCoversDate("2026-08-12", "2026-08-14", "2026-08-14")).toBe(false);
    expect(stayCoversDate("2026-08-12", "2026-08-14", "2026-08-11")).toBe(false);
  });

  it("includes site-matched hotel guests in digests for in-house nights", () => {
    const mainStay = {
      status: "confirmed" as const,
      email: "hotel@example.com",
      checkIn: "2026-08-12",
      checkOut: "2026-08-14",
      inviteSite: "main" as const,
    };
    expect(
      stayEligibleForDigest(mainStay, "main", "2026-08-12", "2026-08-13"),
    ).toBe(true);
    // Bride digest must not pick up a main stay
    expect(
      stayEligibleForDigest(mainStay, "mehfil", "2026-08-12", "2026-08-13"),
    ).toBe(false);

    const mehfilStay = {
      ...mainStay,
      inviteSite: "mehfil" as const,
      inviteTier: "mehfil" as const,
    };
    expect(
      stayEligibleForDigest(mehfilStay, "mehfil", "2026-08-12", "2026-08-13"),
    ).toBe(true);
    expect(
      stayEligibleForDigest(mehfilStay, "main", "2026-08-12", "2026-08-13"),
    ).toBe(false);

    expect(
      stayEligibleForDigest(
        { ...mainStay, status: "declined" },
        "main",
        "2026-08-12",
        "2026-08-13",
      ),
    ).toBe(false);
    expect(
      stayEligibleForDigest(
        { ...mainStay, checkIn: "2026-08-15", checkOut: "2026-08-16" },
        "main",
        "2026-08-12",
        "2026-08-13",
      ),
    ).toBe(false);
  });

  it("normalizes job schedule and schedule windows", () => {
    const config = normalizeEventEmailJobConfig({
      timeIst: "25:99",
      enabled: false,
    });
    expect(config.timeIst).toBe("21:00");
    expect(config.enabled).toBe(false);
    expect(config.scope).toBe("all");
    expect(
      normalizeEventEmailJobConfig({
        previewTimeIst: "20:00",
        thanksEnabled: false,
        previewEnabled: false,
        scope: "bride",
      }).scope,
    ).toBe("bride");
    expect(
      normalizeEventEmailJobConfig({
        previewTimeIst: "20:00",
        thanksEnabled: false,
        previewEnabled: false,
      }).enabled,
    ).toBe(false);
    expect(timeIstToMinutes("21:00")).toBe(21 * 60);
    expect(isWithinScheduleWindow(21 * 60 + 10, "21:00")).toBe(true);
    expect(isWithinScheduleWindow(21 * 60 + 56, "21:00")).toBe(false);
    expect(isWithinScheduleWindow(20 * 60 + 59, "21:00")).toBe(false);

    const next = nextFiringIso(
      "21:00",
      new Date("2026-08-08T10:00:00+05:30"),
    );
    expect(next.asOfDateKey).toBe("2026-08-08");
    const later = nextFiringIso(
      "21:00",
      new Date("2026-08-08T21:30:00+05:30"),
    );
    expect(later.asOfDateKey).toBe("2026-08-09");
  });

  it("builds one evening digest with today and tomorrow", () => {
    const today: ManagedEvent = {
      id: "sangeet",
      name: "Sangeet",
      date: "9th August 2026",
      day: "Sunday Night",
      time: "8:00 PM",
      venue: "Panipat",
      venueDetail: "",
      address: "Panipat, Haryana",
      description: "Sangeet",
      icon: "sun",
    };
    const tomorrow: ManagedEvent = {
      id: "haldi",
      name: "Haldi",
      date: "12th August 2026",
      day: "Wednesday Morning",
      time: "9:00 AM",
      venue: "Maple Garden",
      venueDetail: "Sukhmani Resort",
      address: "Buria Road, Jagadhri",
      description: "Haldi",
      icon: "sun",
    };

    const digest = buildEventEmailParts({
      guestName: "Auntie",
      todayLabel: "9th August 2026",
      tomorrowLabel: "12th August 2026",
      todayEvents: [today],
      tomorrowEvents: [tomorrow],
      links: [
        {
          label: "Wish for the groom & bride",
          url: "https://swaneet.wedding/wishes",
        },
      ],
    });
    expect(digest.subject).toContain("Thank you");
    expect(digest.subject).toContain("Haldi");
    expect(digest.text).toContain("Sangeet");
    expect(digest.text).toContain("Haldi");
    expect(digest.text).toContain("Wish for the groom & bride");
    expect(digest.html).toContain("Your evening update");
    expect(digest.html).toContain("Today");
    expect(digest.html).toContain("Tomorrow");
  });
});

describe("arrival announcement email", () => {
  it("keeps groom announcements free of bride Sangeet", () => {
    const groom = buildAnnouncementEmailParts({
      guestName: "Aman",
      wave: "today",
      site: "main",
    });
    expect(groom.subject).toContain("Celebrations begin from 11th August");
    expect(groom.subject).not.toContain("Sangeet");
    expect(groom.subject).not.toContain("Reminder ·");
    expect(groom.text).toContain("Dear Aman");
    expect(groom.text).not.toMatch(/sangeet/i);
    expect(groom.text).not.toMatch(/panipat/i);
    expect(groom.html).toContain("11th August 2026");
    expect(groom.html).not.toMatch(/sangeet/i);
    expect(groom.html).toContain("Celebration timeline");
    expect(groom.html).toContain("Wedding dinner");
    expect(groom.html).toContain("Open wedding site");
    expect(groom.html).toContain("linear-gradient");

    const reminder = buildAnnouncementEmailParts({
      guestName: "Aman",
      wave: "tomorrow",
      site: "main",
    });
    expect(reminder.subject).toContain("Reminder ·");
    expect(reminder.subject).not.toContain("Sangeet");
    expect(reminder.html).toContain("A gentle reminder");
    expect(reminder.text).not.toMatch(/sangeet/i);
  });

  it("includes Sangeet only for mehfil bride guests", () => {
    const mehfil = buildAnnouncementEmailParts({
      guestName: "Simran",
      wave: "today",
      site: "mehfil",
    });
    expect(mehfil.subject).toContain("Sangeet");
    expect(mehfil.text).toContain("Sangeet");
    expect(mehfil.text).toContain("Panipat");
    expect(mehfil.html).toContain("Sangeet");
    expect(mehfil.html).toContain("9th August 2026");

    const laavan = buildAnnouncementEmailParts({
      guestName: "Simran",
      wave: "today",
      site: "laavan",
    });
    expect(laavan.subject).not.toContain("Sangeet");
    expect(laavan.text).not.toMatch(/sangeet/i);
  });

  it("builds apology emails with site-correct schedules", () => {
    const groom = buildAnnouncementEmailParts({
      guestName: "Uncle",
      wave: "apology",
      site: "main",
    });
    expect(groom.subject).toContain("main Events schedule");
    expect(groom.subject).not.toContain("Mehfil invite schedule");
    expect(groom.text).toMatch(/sorry/i);
    expect(groom.text).toMatch(/mixed up groom and bride events/i);
    expect(groom.text).not.toMatch(/not part of your invitation/i);
    // Fallback main schedule has no bride-invite Panipat ceremonies
    expect(groom.text).not.toMatch(/\bMehndi\b|\bJaggo\b|Sukhmani Sahib/i);
    expect(groom.text).toContain("11th August");
    expect(groom.html).toContain("A sincere apology");

    const mehfil = buildAnnouncementEmailParts({
      guestName: "Auntie",
      wave: "apology",
      site: "mehfil",
    });
    expect(mehfil.subject).toContain("Mehfil invite schedule");
    expect(mehfil.text).toMatch(/mixed up groom and bride events/i);
    expect(mehfil.text).toContain("Sangeet");
    expect(mehfil.text).toContain("Mehndi");
    expect(mehfil.text).toContain("Jaggo");
    expect(mehfil.html).toContain("Panipat");
  });

  it("includes a main dashboard Sangeet in main apology mail", () => {
    const managedSangeet: ManagedEvent = {
      id: "event-manual-sangeet",
      name: "Sangeet",
      date: "11th August 2099",
      day: "Tuesday Night",
      time: "8:30 PM",
      venue: "Groom Lawn",
      venueDetail: "",
      address: "Jagadhri",
      description: "Main-site Sangeet",
      icon: "sun",
    };
    const dinner: ManagedEvent = {
      id: "wedding-dinner",
      name: "Wedding Dinner",
      date: "12th August 2026",
      day: "Wednesday Night",
      time: "8:00 PM Onwards",
      venue: "Maple Garden",
      venueDetail: "",
      address: "Jagadhri",
      description: "",
      icon: "moon",
    };
    const mail = buildAnnouncementEmailParts({
      guestName: "Guest",
      wave: "apology",
      site: "main",
      events: [managedSangeet, dinner],
    });
    expect(mail.text).toContain("Sangeet");
    expect(mail.text).toContain("8:30 PM");
    expect(mail.text).toContain("Groom Lawn");
    expect(mail.text).not.toMatch(/\bMehndi\b|\bJaggo\b/);
    expect(mail.html).toContain("Groom Lawn");
  });

  it("lets a dashboard Sangeet replace the hardcoded bride Sangeet", () => {
    const hardcoded: ManagedEvent = {
      id: "bride-sangeet",
      name: "Sangeet",
      date: "9th August 2026",
      day: "Sunday Night",
      time: "8:00 PM",
      venue: "Panipat",
      venueDetail: "",
      address: "",
      description: "",
      icon: "sun",
    };
    const managed: ManagedEvent = {
      id: "event-1",
      name: "Sangeet",
      date: "9th August 2026",
      day: "Sunday Night",
      time: "9:00 PM",
      venue: "New Venue",
      venueDetail: "",
      address: "",
      description: "",
      icon: "sun",
    };
    const merged = mergeScheduleEvents([hardcoded], [managed]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.time).toBe("9:00 PM");
    expect(merged[0]?.venue).toBe("New Venue");
  });

  it("drops already-done events from announcement schedule payloads", () => {
    const pastMarked: ManagedEvent = {
      id: "roka",
      name: "Roka",
      date: "14th April 2026",
      day: "Tuesday",
      time: "12:00 PM",
      venue: "Jai Paradise",
      venueDetail: "",
      address: "",
      description: "",
      icon: "heart",
      done: true,
    };
    const pastByDate: ManagedEvent = {
      id: "old-dinner",
      name: "Engagement dinner",
      date: "1st January 2020",
      day: "Wednesday",
      time: "8:00 PM",
      venue: "Old Venue",
      venueDetail: "",
      address: "",
      description: "",
      icon: "heart",
      // not marked done — still excluded because the date passed
    };
    const upcoming: ManagedEvent = {
      id: "sangeet-main",
      name: "Sangeet",
      date: "11th August 2099",
      day: "Tuesday",
      time: "8:00 PM",
      venue: "HOTEL NG PARADISE",
      venueDetail: "",
      address: "",
      description: "",
      icon: "sun",
    };
    const mail = buildAnnouncementEmailParts({
      guestName: "Guest",
      wave: "apology",
      site: "main",
      events: [pastMarked, pastByDate, upcoming],
    });
    expect(mail.text).not.toContain("Roka");
    expect(mail.text).not.toContain("Engagement dinner");
    expect(mail.text).toContain("Sangeet");
    expect(mail.html).not.toContain("Jai Paradise");
    expect(mail.html).not.toContain("Old Venue");
    expect(mail.html).toContain("HOTEL NG PARADISE");
  });

  it("recognizes main-schedule test subjects for the test inbox gate", () => {
    expect(ANNOUNCEMENT_TEST_EMAIL).toBe("haneet555@gmail.com");
    expect(
      isMainAnnouncementTestSubject(
        "[TEST] Apology · we mixed groom & bride events · main Events schedule · #Swaneet",
        "apology",
      ),
    ).toBe(true);
    expect(
      isMainAnnouncementTestSubject(
        "Apology · we mixed groom & bride events · main Events schedule · #Swaneet",
        "apology",
      ),
    ).toBe(false);
    expect(
      isMainAnnouncementTestSubject(
        "[TEST] Apology · we mixed groom & bride events · Mehfil invite schedule · #Swaneet",
        "apology",
      ),
    ).toBe(false);
  });

  it("does not leak main-only dashboard events into Mehfil schedule", () => {
    const mehfilInvite: ManagedEvent[] = [
      {
        id: "bride-sangeet",
        name: "Sangeet",
        date: "9th August 2026",
        day: "Sunday Night",
        time: "8:00 PM",
        venue: "Panipat",
        venueDetail: "",
        address: "",
        description: "",
        icon: "sun",
      },
      {
        id: "bride-haldi",
        name: "Haldi",
        date: "12th August 2026",
        day: "Wednesday Morning",
        time: "9:00 AM",
        venue: "Maple Garden",
        venueDetail: "",
        address: "",
        description: "",
        icon: "sun",
      },
    ];
    const managed: ManagedEvent[] = [
      {
        id: "event-roka",
        name: "Roka",
        date: "14th April 2026",
        day: "Tuesday",
        time: "12:00 PM",
        venue: "Jai Paradise",
        venueDetail: "",
        address: "",
        description: "",
        icon: "heart",
      },
      {
        id: "event-main-sangeet",
        name: "Sangeet",
        date: "11th August 2026",
        day: "Tuesday",
        time: "8:00 PM",
        venue: "HOTEL NG PARADISE",
        venueDetail: "",
        address: "",
        description: "",
        icon: "sun",
      },
      {
        id: "event-override-sangeet",
        name: "Sangeet",
        date: "9th August 2026",
        day: "Sunday Night",
        time: "8:15 PM",
        venue: "Panipat Updated",
        venueDetail: "",
        address: "",
        description: "",
        icon: "sun",
      },
    ];
    const merged = mergeInviteWithManagedOverrides(mehfilInvite, managed);
    expect(merged.map((e) => e.name).sort()).toEqual(["Haldi", "Sangeet"]);
    expect(merged.find((e) => e.name === "Sangeet")?.venue).toBe(
      "Panipat Updated",
    );
    expect(merged.find((e) => e.name === "Sangeet")?.time).toBe("8:15 PM");
    expect(merged.some((e) => e.name === "Roka")).toBe(false);
    expect(merged.some((e) => /NG PARADISE/i.test(e.venue))).toBe(false);
  });
});
