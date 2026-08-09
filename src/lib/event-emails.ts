import {
  brideInvites,
  eventsForInvite,
  getBrideInvite,
} from "@/data/bride-invites";
import { parseDisplayDate, sortEventsByDateTime } from "@/lib/datetime";
import {
  buildEventEmailParts,
  type EventEmailLink,
} from "@/lib/email-event-template";
import { sendResendEmail } from "@/lib/email";
import { filterUpcomingEvents } from "@/lib/email-itinerary";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { absoluteGuestUrl } from "@/lib/guest-paths";
import {
  inviteSlugForSite,
  resolveEntryInviteSite,
} from "@/lib/rsvp-days";
import {
  getFeatureFlags,
  hasEventEmailSend,
  listEvents,
  listRsvps,
  recordEventEmailSend,
} from "@/lib/store";
import type {
  EventEmailAudienceScope,
  EventEmailPhase,
  FeatureFlags,
  FeatureSite,
  ManagedEvent,
  RsvpEntry,
} from "@/lib/types";

export type { EventEmailAudienceScope };

export type EventEmailRecipient = {
  email: string;
  name: string;
  site: FeatureSite;
  rsvpId: string;
};

export type EventEmailPlan = {
  phase: EventEmailPhase;
  /** As-of IST day the digest fires */
  dateKey: string;
  todayDateKey: string;
  tomorrowDateKey: string;
  todayLabel: string;
  tomorrowLabel: string;
  site: FeatureSite;
  todayEvents: ManagedEvent[];
  tomorrowEvents: ManagedEvent[];
  recipients: EventEmailRecipient[];
  links: EventEmailLink[];
};

export type EventEmailRunOptions = {
  /** Always digest for the consolidated evening email */
  phase?: EventEmailPhase;
  /** Override “today” in IST (YYYY-MM-DD) for testing */
  asOfDateKey?: string;
  dryRun?: boolean;
  /** Re-send even if already recorded */
  force?: boolean;
  /**
   * Limit planning to main (groom site), bride invites, or all.
   * Defaults to all sites.
   */
  scope?: EventEmailAudienceScope;
};

/** Feature sites covered by a digest audience scope. */
export function sitesForAudienceScope(
  scope: EventEmailAudienceScope = "all",
): FeatureSite[] {
  if (scope === "main") return ["main"];
  if (scope === "bride") return ["mehfil", "laavan"];
  return ["main", "mehfil", "laavan"];
}

export type EventEmailRunResult = {
  phase: EventEmailPhase;
  asOfDateKey: string;
  targetDateKey: string;
  todayDateKey: string;
  tomorrowDateKey: string;
  dryRun: boolean;
  plans: Array<{
    site: FeatureSite;
    dateKey: string;
    dayLabel: string;
    eventNames: string[];
    recipientCount: number;
    recipients: Array<{ email: string; name: string; skipped?: string }>;
  }>;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
};

function siteBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://swaneet.vercel.app");
  return raw.replace(/\/$/, "");
}

/** Current calendar date in Asia/Kolkata as YYYY-MM-DD */
export function istDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/** Add calendar days to a YYYY-MM-DD key (date-only arithmetic). */
export function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  const yy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function displayDayLabel(events: ManagedEvent[], dateKey: string): string {
  const first = events[0];
  if (first?.date) return first.date;
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function invitePath(site: FeatureSite): string {
  if (site === "main") return "";
  const slug = inviteSlugForSite(site);
  return slug ? `/i/${slug}` : "";
}

async function eventsForSite(site: FeatureSite): Promise<ManagedEvent[]> {
  if (site === "main") return listEvents();
  const invite =
    brideInvites.find((item) => item.tier === site) ||
    (site === "mehfil"
      ? getBrideInvite("swnt-chugh-mehfil-k7m2")
      : getBrideInvite("swnt-chugh-laavan-p9x4"));
  return invite ? eventsForInvite(invite) : [];
}

function eventsOnDate(
  events: ManagedEvent[],
  dateKey: string,
): ManagedEvent[] {
  return sortEventsByDateTime(
    events.filter((event) => parseDisplayDate(event.date) === dateKey),
  );
}

function guestEmail(rsvp: RsvpEntry): string {
  return (rsvp.email || rsvp.authEmail || "").trim().toLowerCase();
}

/** Attending that day (yes). Falls back to overall yes when no dayResponses. */
function isAttendingDay(rsvp: RsvpEntry, dateKey: string): boolean {
  const days = rsvp.dayResponses || [];
  if (days.length) {
    const match = days.find((day) => day.dateKey === dateKey);
    return match?.attendance === "yes";
  }
  return rsvp.attendance === "yes";
}

function buildLinks(input: {
  site: FeatureSite;
  todayEvents: ManagedEvent[];
  flags: FeatureFlags;
}): EventEmailLink[] {
  const base = siteBaseUrl();
  const path = invitePath(input.site);
  const slug = inviteSlugForSite(input.site);
  const links: EventEmailLink[] = [];

  links.push({
    label: "Wedding schedule",
    url: `${base}${path || "/"}#events`,
    hint: "Times, venues, and directions",
  });

  if (isFeatureEnabled(input.flags, input.site, "guest_photos")) {
    links.push({
      label: "Upload photos",
      url: absoluteGuestUrl("/upload", { siteUrl: base, inviteSlug: slug }),
      hint: "Share moments — family reviews before the gallery",
    });
  }

  if (isFeatureEnabled(input.flags, input.site, "gallery")) {
    const galleryBase = absoluteGuestUrl("/gallery", {
      siteUrl: base,
      inviteSlug: slug,
    });
    const firstEvent = input.todayEvents[0];
    links.push({
      label: "Today’s photos",
      url: firstEvent
        ? `${galleryBase}?event=${encodeURIComponent(firstEvent.id)}`
        : galleryBase,
      hint: "Browse approved wedding photos",
    });
  }

  if (isFeatureEnabled(input.flags, input.site, "face_find")) {
    links.push({
      label: "Find photos of you",
      url: absoluteGuestUrl("/my-photos", {
        siteUrl: base,
        inviteSlug: slug,
      }),
      hint: "Sign in and upload a selfie",
    });
  }

  if (isFeatureEnabled(input.flags, input.site, "guest_messages")) {
    links.push({
      label: "Wish for the groom & bride",
      url: `${absoluteGuestUrl("/wishes", {
        siteUrl: base,
        inviteSlug: slug,
      })}#write-wish`,
      hint: "Leave a short blessing for Swaneet",
    });
  }

  return links;
}

export async function planEventEmails(
  options: EventEmailRunOptions,
): Promise<{
  asOfDateKey: string;
  todayDateKey: string;
  tomorrowDateKey: string;
  plans: EventEmailPlan[];
}> {
  const asOfDateKey = options.asOfDateKey || istDateKey();
  const todayDateKey = asOfDateKey;
  const tomorrowDateKey = shiftDateKey(asOfDateKey, 1);

  const flags = await getFeatureFlags();
  const rsvps = await listRsvps();
  const sites = sitesForAudienceScope(options.scope || "all");
  const plans: EventEmailPlan[] = [];

  for (const site of sites) {
    const all = await eventsForSite(site);
    const todayEvents = eventsOnDate(all, todayDateKey).filter(
      (event) => !event.done,
    );
    // Tomorrow preview should never include finished/past events.
    const tomorrowEvents = filterUpcomingEvents(
      eventsOnDate(all, tomorrowDateKey),
    );
    if (!todayEvents.length && !tomorrowEvents.length) continue;

    const todayLabel = displayDayLabel(todayEvents, todayDateKey);
    const tomorrowLabel = displayDayLabel(tomorrowEvents, tomorrowDateKey);
    const recipients: EventEmailRecipient[] = [];
    const seen = new Set<string>();

    // Keep digests strictly site-scoped: only RSVPs for this invite surface
    // who are attending today or tomorrow. Never mix groom/bride audiences.
    for (const rsvp of rsvps) {
      const rsvpSite = resolveEntryInviteSite(rsvp);
      if (rsvpSite !== site) continue;
      const attendingToday = isAttendingDay(rsvp, todayDateKey);
      const attendingTomorrow = isAttendingDay(rsvp, tomorrowDateKey);
      if (!attendingToday && !attendingTomorrow) continue;

      const email = guestEmail(rsvp);
      if (!email || seen.has(email)) continue;

      seen.add(email);
      recipients.push({
        email,
        name: rsvp.name,
        site: rsvpSite,
        rsvpId: rsvp.id,
      });
    }

    plans.push({
      phase: "digest",
      dateKey: asOfDateKey,
      todayDateKey,
      tomorrowDateKey,
      todayLabel,
      tomorrowLabel,
      site,
      todayEvents,
      tomorrowEvents,
      recipients,
      links: buildLinks({
        site,
        todayEvents,
        flags,
      }),
    });
  }

  return { asOfDateKey, todayDateKey, tomorrowDateKey, plans };
}

export async function runEventEmails(
  options: EventEmailRunOptions,
): Promise<EventEmailRunResult> {
  const { asOfDateKey, todayDateKey, tomorrowDateKey, plans } =
    await planEventEmails(options);
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];
  const planSummaries: EventEmailRunResult["plans"] = [];

  for (const plan of plans) {
    const recipientRows: EventEmailRunResult["plans"][number]["recipients"] =
      [];

    for (const guest of plan.recipients) {
      if (
        !force &&
        (await hasEventEmailSend("digest", plan.dateKey, guest.email))
      ) {
        skipped += 1;
        recipientRows.push({
          email: guest.email,
          name: guest.name,
          skipped: "already sent",
        });
        continue;
      }

      if (dryRun) {
        recipientRows.push({ email: guest.email, name: guest.name });
        continue;
      }

      const parts = buildEventEmailParts({
        guestName: guest.name,
        todayLabel: plan.todayLabel,
        tomorrowLabel: plan.tomorrowLabel,
        todayEvents: plan.todayEvents,
        tomorrowEvents: plan.tomorrowEvents,
        links: plan.links,
      });

      const result = await sendResendEmail({
        kind: "event_digest",
        to: guest.email,
        subject: parts.subject,
        text: parts.text,
        html: parts.html,
      });

      if (result.ok) {
        sent += 1;
        await recordEventEmailSend({
          kind: "digest",
          dateKey: plan.dateKey,
          email: guest.email,
          site: plan.site,
        });
        recipientRows.push({ email: guest.email, name: guest.name });
      } else {
        failed += 1;
        errors.push(`${guest.email}: ${result.error}`);
        recipientRows.push({
          email: guest.email,
          name: guest.name,
          skipped: result.error,
        });
      }
    }

    const eventNames = [
      ...plan.todayEvents.map((e) => e.name),
      ...plan.tomorrowEvents.map((e) => e.name),
    ];

    planSummaries.push({
      site: plan.site,
      dateKey: plan.dateKey,
      dayLabel: [plan.todayLabel, plan.tomorrowLabel].filter(Boolean).join(" → "),
      eventNames,
      recipientCount: plan.recipients.length,
      recipients: recipientRows,
    });
  }

  return {
    phase: "digest",
    asOfDateKey,
    targetDateKey: tomorrowDateKey,
    todayDateKey,
    tomorrowDateKey,
    dryRun,
    plans: planSummaries,
    sent: dryRun ? 0 : sent,
    skipped,
    failed,
    errors,
  };
}
