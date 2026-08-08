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
  EventEmailPhase,
  FeatureFlags,
  FeatureSite,
  ManagedEvent,
  RsvpEntry,
} from "@/lib/types";

export type EventEmailRecipient = {
  email: string;
  name: string;
  site: FeatureSite;
  rsvpId: string;
};

export type EventEmailPlan = {
  phase: EventEmailPhase;
  /** Day the email is about (IST YYYY-MM-DD) */
  dateKey: string;
  dayLabel: string;
  site: FeatureSite;
  events: ManagedEvent[];
  recipients: EventEmailRecipient[];
  links: EventEmailLink[];
};

export type EventEmailRunOptions = {
  phase: EventEmailPhase;
  /** Override “today” in IST (YYYY-MM-DD) for testing */
  asOfDateKey?: string;
  dryRun?: boolean;
  /** Re-send even if already recorded */
  force?: boolean;
};

export type EventEmailRunResult = {
  phase: EventEmailPhase;
  asOfDateKey: string;
  targetDateKey: string;
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
  phase: EventEmailPhase;
  site: FeatureSite;
  events: ManagedEvent[];
  flags: FeatureFlags;
}): EventEmailLink[] {
  const base = siteBaseUrl();
  const path = invitePath(input.site);
  const slug = inviteSlugForSite(input.site);
  const links: EventEmailLink[] = [];

  links.push({
    label: input.phase === "preview" ? "Full schedule" : "Wedding site",
    url: `${base}${path || "/"}#events`,
    hint: "Times, venues, and directions",
  });

  if (isFeatureEnabled(input.flags, input.site, "guest_photos")) {
    links.push({
      label: "Upload photos",
      url: absoluteGuestUrl("/upload", { siteUrl: base, inviteSlug: slug }),
      hint: "Share moments from today — family reviews before the gallery",
    });
  }

  if (isFeatureEnabled(input.flags, input.site, "gallery")) {
    const galleryBase = absoluteGuestUrl("/gallery", {
      siteUrl: base,
      inviteSlug: slug,
    });
    const firstEvent = input.events[0];
    links.push({
      label: input.phase === "thanks" ? "Today’s photos" : "Photo gallery",
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
  targetDateKey: string;
  plans: EventEmailPlan[];
}> {
  const asOfDateKey = options.asOfDateKey || istDateKey();
  const targetDateKey =
    options.phase === "preview"
      ? shiftDateKey(asOfDateKey, 1)
      : asOfDateKey;

  const flags = await getFeatureFlags();
  const rsvps = await listRsvps();
  const sites: FeatureSite[] = ["main", "mehfil", "laavan"];
  const plans: EventEmailPlan[] = [];

  for (const site of sites) {
    const all = await eventsForSite(site);
    const events = eventsOnDate(all, targetDateKey);
    if (!events.length) continue;

    const dayLabel = displayDayLabel(events, targetDateKey);
    const recipients: EventEmailRecipient[] = [];
    const seen = new Set<string>();

    for (const rsvp of rsvps) {
      const rsvpSite = resolveEntryInviteSite(rsvp);
      // Match invite surface exactly so mehfil/laavan guests aren’t emailed twice
      if (rsvpSite !== site) continue;
      if (!isAttendingDay(rsvp, targetDateKey)) continue;

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
      phase: options.phase,
      dateKey: targetDateKey,
      dayLabel,
      site,
      events,
      recipients,
      links: buildLinks({
        phase: options.phase,
        site,
        events,
        flags,
      }),
    });
  }

  return { asOfDateKey, targetDateKey, plans };
}

export async function runEventEmails(
  options: EventEmailRunOptions,
): Promise<EventEmailRunResult> {
  const { asOfDateKey, targetDateKey, plans } = await planEventEmails(options);
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
      if (!force && (await hasEventEmailSend(plan.phase, plan.dateKey, guest.email))) {
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
        phase: plan.phase,
        guestName: guest.name,
        dayLabel: plan.dayLabel,
        events: plan.events,
        links: plan.links,
      });

      const result = await sendResendEmail({
        kind: plan.phase === "preview" ? "event_preview" : "event_thanks",
        to: guest.email,
        subject: parts.subject,
        text: parts.text,
        html: parts.html,
      });

      if (result.ok) {
        sent += 1;
        await recordEventEmailSend({
          kind: plan.phase,
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

    planSummaries.push({
      site: plan.site,
      dateKey: plan.dateKey,
      dayLabel: plan.dayLabel,
      eventNames: plan.events.map((e) => e.name),
      recipientCount: plan.recipients.length,
      recipients: recipientRows,
    });
  }

  return {
    phase: options.phase,
    asOfDateKey,
    targetDateKey,
    dryRun,
    plans: planSummaries,
    sent: dryRun ? 0 : sent,
    skipped,
    failed,
    errors,
  };
}
