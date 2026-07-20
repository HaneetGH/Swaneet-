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
