import {
  brideEvents,
  brideInvites,
  eventsForInvite,
  getBrideInvite,
} from "@/data/bride-invites";
import { wedding } from "@/data/wedding";
import { parseDisplayDate, sortEventsByDateTime } from "@/lib/datetime";
import { sendResendEmail } from "@/lib/email";
import { resolveEntryInviteSite } from "@/lib/rsvp-days";
import {
  listAccommodations,
  listEmailLogs,
  listEvents,
  listGuestLogins,
  listGuestMessages,
  listRsvps,
} from "@/lib/store";
import type { FeatureSite, ManagedEvent } from "@/lib/types";

export type AnnouncementWave = "today" | "tomorrow" | "apology";

export type AnnouncementSource = "rsvp" | "stay" | "wish" | "login";

export type AnnouncementRecipient = {
  email: string;
  name: string;
  sources: AnnouncementSource[];
  /** Invite surface this copy is for — never mix groom/bride into one send */
  site: FeatureSite;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeEmail(value: string | undefined | null): string {
  return (value || "").trim().toLowerCase();
}

function siteBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://swaneet.vercel.app");
  return raw.replace(/\/$/, "");
}

/** Mehfil invites include Panipat Sangeet; groom/main and laavan do not. */
export function announcementIncludesSangeet(site: FeatureSite): boolean {
  return site === "mehfil";
}

function recipientKey(email: string, site: FeatureSite): string {
  return `${email}::${site}`;
}

function eventDedupeKey(event: ManagedEvent): string {
  const dateKey = parseDisplayDate(event.date) || event.date.trim().toLowerCase();
  return `${dateKey}::${event.name.trim().toLowerCase()}`;
}

/**
 * Merge schedule sources. Later arrays win on the same date+name so a
 * dashboard-managed Sangeet replaces the hardcoded bride-invites copy.
 */
export function mergeScheduleEvents(
  ...groups: ManagedEvent[][]
): ManagedEvent[] {
  const byKey = new Map<string, ManagedEvent>();
  for (const group of groups) {
    for (const event of group) {
      byKey.set(eventDedupeKey(event), event);
    }
  }
  return sortEventsByDateTime([...byKey.values()]);
}

function formatScheduleLine(event: ManagedEvent): string {
  const when = [event.day, event.date].filter(Boolean).join(" · ");
  const place = [event.venue, event.venueDetail]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
  const bits = [
    when || event.date,
    `— ${event.name}`,
    place ? `at ${place}` : null,
    event.time?.trim() ? `· ${event.time.trim()}` : null,
  ].filter(Boolean);
  return `${bits.join(" ")}.`;
}

function formatScheduleHtmlRow(event: ManagedEvent): string {
  const when = [event.day, event.date].filter(Boolean).join(" · ");
  const place = [event.venue, event.venueDetail]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
  const detail = [place, event.time?.trim()].filter(Boolean).join(" · ");
  return `
                      <tr>
                        <td style="padding:14px 12px;border-bottom:1px solid #efe4cf;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">${escapeHtml(event.name)}</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1208;">${escapeHtml(when || event.date)}</p>
                          ${
                            detail
                              ? `<p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;line-height:1.5;">${escapeHtml(detail)}</p>`
                              : ""
                          }
                        </td>
                      </tr>`;
}

/**
 * Live schedule for announcements:
 * - apology → dashboard events + full Mehfil bride list (manual Sangeet included)
 * - main → dashboard / managed events only
 * - mehfil → bride invite events + dashboard events (dashboard wins on clashes)
 * - laavan → laavan invite events + dashboard events
 */
export async function resolveAnnouncementScheduleEvents(
  site: FeatureSite,
  wave: AnnouncementWave,
): Promise<ManagedEvent[]> {
  const managed = await listEvents();
  const mehfilInvite =
    brideInvites.find((item) => item.tier === "mehfil") ||
    getBrideInvite("swnt-chugh-mehfil-k7m2");
  const laavanInvite =
    brideInvites.find((item) => item.tier === "laavan") ||
    getBrideInvite("swnt-chugh-laavan-p9x4");

  if (wave === "apology") {
    const mehfilEvents = mehfilInvite ? eventsForInvite(mehfilInvite) : brideEvents;
    return mergeScheduleEvents(mehfilEvents, managed);
  }
  if (site === "main") return sortEventsByDateTime(managed);
  if (site === "mehfil") {
    const inviteEvents = mehfilInvite ? eventsForInvite(mehfilInvite) : [];
    return mergeScheduleEvents(inviteEvents, managed);
  }
  const inviteEvents = laavanInvite ? eventsForInvite(laavanInvite) : [];
  return mergeScheduleEvents(inviteEvents, managed);
}

function upsertRecipient(
  byKey: Map<string, AnnouncementRecipient>,
  input: {
    email?: string | null;
    name?: string | null;
    source: AnnouncementSource;
    site: FeatureSite;
  },
) {
  const email = normalizeEmail(input.email);
  if (!email) return;
  const name = (input.name || "").trim();
  const key = recipientKey(email, input.site);
  const existing = byKey.get(key);
  if (existing) {
    if (!existing.sources.includes(input.source)) {
      existing.sources.push(input.source);
    }
    if ((!existing.name || existing.name === "Guest") && name) {
      existing.name = name;
    }
    return;
  }
  byKey.set(key, {
    email,
    name: name || "Guest",
    sources: [input.source],
    site: input.site,
  });
}

/**
 * Guests with an email, kept separate per invite site so groom and bride
 * never share one mixed announcement.
 * Sources: RSVP (not “no”), stay (not declined), wishes, site logins.
 */
export async function collectAnnouncementRecipients(): Promise<
  AnnouncementRecipient[]
> {
  const [rsvps, stays, wishes, logins] = await Promise.all([
    listRsvps(),
    listAccommodations(),
    listGuestMessages(),
    listGuestLogins(),
  ]);
  const byKey = new Map<string, AnnouncementRecipient>();

  for (const rsvp of rsvps) {
    if (rsvp.attendance === "no") continue;
    upsertRecipient(byKey, {
      email: rsvp.email || rsvp.authEmail,
      name: rsvp.name,
      source: "rsvp",
      site: resolveEntryInviteSite(rsvp),
    });
  }

  for (const stay of stays) {
    if (stay.status === "declined") continue;
    if (stay.offerStatus === "declined") continue;
    upsertRecipient(byKey, {
      email: stay.email || stay.authEmail,
      name: stay.name,
      source: "stay",
      site: resolveEntryInviteSite(stay),
    });
  }

  for (const wish of wishes) {
    if (wish.source === "sample") continue;
    if (wish.status === "rejected") continue;
    upsertRecipient(byKey, {
      email: wish.authEmail,
      name: wish.displayName,
      source: "wish",
      site: resolveEntryInviteSite(wish),
    });
  }

  for (const login of logins) {
    upsertRecipient(byKey, {
      email: login.email,
      name: login.name,
      source: "login",
      site: resolveEntryInviteSite(login),
    });
  }

  return [...byKey.values()].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, "en");
    if (byName) return byName;
    return a.site.localeCompare(b.site);
  });
}

function announcementSubjectMarker(site: FeatureSite, wave: AnnouncementWave) {
  // Distinct from the earlier wedding-only apology subjects so a resend is allowed.
  if (wave === "apology") {
    return "Apology · we mixed groom & bride events · full correct schedule";
  }
  if (announcementIncludesSangeet(site)) {
    return wave === "tomorrow" ? "Reminder · Sangeet" : "Sangeet ·";
  }
  return wave === "tomorrow" ? "Reminder · Celebrations begin" : "Celebrations begin";
}

export function buildAnnouncementEmailParts(input: {
  guestName: string;
  wave: AnnouncementWave;
  /** Defaults to main (groom) — no bride-only events */
  site?: FeatureSite;
  /**
   * Live events (dashboard + invite). When provided, schedule/timeline are
   * built from these so a manually created Sangeet appears in the email.
   */
  events?: ManagedEvent[];
}): { subject: string; text: string; html: string } {
  const site = input.site || "main";
  const isApology = input.wave === "apology";
  const liveEvents = input.events?.length
    ? sortEventsByDateTime(input.events)
    : [];
  const hasLiveSangeet = liveEvents.some((event) =>
    /sangeet/i.test(event.name),
  );
  /**
   * Apology always lists full celebrations. Mehfil gets Panipat events.
   * If live events include Sangeet (e.g. dashboard-managed), show it too.
   */
  const includePanipatEvents =
    isApology ||
    announcementIncludesSangeet(site) ||
    (liveEvents.length > 0 && hasLiveSangeet);
  const greet = input.guestName.trim() || "Friend";
  const siteUrl = siteBaseUrl();
  const venue = wedding.venue.fullAddress;

  let subject: string;
  let opening: string;
  if (isApology) {
    subject = `Apology · we mixed groom & bride events · full correct schedule · ${wedding.hashtag}`;
    opening =
      "We’re sorry — a recent email mixed up groom and bride events. Please follow this correct #Swaneet schedule below (including Panipat celebrations such as Sangeet, then wedding days in Jagadhri).";
  } else if (includePanipatEvents) {
    subject =
      input.wave === "tomorrow"
        ? `Reminder · Sangeet & wedding from 11th August — please be with us · ${wedding.hashtag}`
        : `Sangeet · Wedding from 11th August — please be with us · ${wedding.hashtag}`;
    opening =
      input.wave === "tomorrow"
        ? "A warm reminder as we get closer — our #Swaneet celebrations include Sangeet on 9th August in Panipat, then wedding days from 11th August. Please make sure you are with us."
        : "With love from both families — our #Swaneet celebrations include Sangeet on 9th August in Panipat, then wedding days from 11th August. Please make sure you are with us for the days ahead.";
  } else {
    subject =
      input.wave === "tomorrow"
        ? `Reminder · Celebrations begin from 11th August — please be with us · ${wedding.hashtag}`
        : `Celebrations begin from 11th August — please be with us · ${wedding.hashtag}`;
    opening =
      input.wave === "tomorrow"
        ? "A warm reminder as we get closer — our #Swaneet celebrations begin from 11th August. Please make sure you are with us."
        : "With love from both families — our #Swaneet celebrations begin from 11th August. Please make sure you are with us for the days ahead.";
  }

  const fallbackScheduleLines = includePanipatEvents
    ? [
        "9th August (Sunday) — Sukhmani Sahib Path in Panipat · 11:00 AM – 1:00 PM.",
        "9th August (Sunday) — Mehndi in Panipat · 2:00 PM onwards.",
        "9th August (Sunday night) — Jaggo in Panipat · 7:00 PM.",
        "9th August (Sunday night) — Sangeet in Panipat · 8:00 PM.",
        "From 11th August 2026 — wedding celebrations in Jagadhri. Kindly plan to be present.",
        "12th August (Wednesday night) — Wedding Dinner at Maple Garden.",
        "13th August (Thursday) — Anand Karaj & Brunch.",
      ]
    : [
        "From 11th August 2026 — wedding celebrations begin. Kindly plan to be present.",
        "12th August (Wednesday night) — Wedding Dinner at Maple Garden.",
        "13th August (Thursday) — Anand Karaj & Brunch.",
      ];

  const scheduleLines = liveEvents.length
    ? liveEvents.map(formatScheduleLine)
    : fallbackScheduleLines;

  const text = [
    `Dear ${greet},`,
    "",
    opening,
    "",
    "Please keep these dates close:",
    ...scheduleLines.map((line) => `• ${line}`),
    "",
    `Venue: ${venue}`,
    "",
    "We can’t wait to celebrate with you. If your plans changed, update your RSVP on the wedding site.",
    "",
    `Wedding site: ${siteUrl}`,
    `Leave a wish: ${siteUrl}/wishes`,
    `Share photos: ${siteUrl}/upload`,
    "",
    "With love,",
    "Haneet & Swarandeep",
    wedding.hashtag,
  ].join("\n");

  const headline = isApology
    ? "A sincere apology"
    : input.wave === "tomorrow"
      ? "A gentle reminder"
      : "Please be with us";
  const mapsUrl =
    wedding.venue.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wedding.venue.mapQuery)}`;

  const heroDates = includePanipatEvents
    ? `Panipat on <strong style="color:#fff8e8;">9th August</strong>
                · Wedding from <strong style="color:#fff8e8;">11th August 2026</strong>`
    : `Celebrations begin from <strong style="color:#fff8e8;">11th August 2026</strong>`;

  const timelineRows = liveEvents.length
    ? liveEvents.map(formatScheduleHtmlRow).join("")
    : includePanipatEvents
      ? `
                      <tr>
                        <td style="padding:14px 12px;border-bottom:1px solid #efe4cf;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">Sukhmani Sahib Path</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1208;">9th August 2026 · Sunday</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;line-height:1.5;">
                            Panipat · 11:00 AM – 1:00 PM
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 12px;border-bottom:1px solid #efe4cf;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">Mehndi</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1208;">9th August 2026 · Sunday</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;line-height:1.5;">
                            Panipat · 2:00 PM onwards
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 12px;border-bottom:1px solid #efe4cf;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">Jaggo</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1208;">9th August 2026 · Sunday night</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;line-height:1.5;">
                            Panipat · 7:00 PM
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 12px;border-bottom:1px solid #efe4cf;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">Sangeet</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#1a1208;">9th August 2026 · Sunday night</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;line-height:1.5;">
                            Panipat · 8:00 PM — music, dance, and celebration with both families.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 12px;border-bottom:1px solid #efe4cf;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">Wedding days</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#1a1208;">11th August 2026</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;line-height:1.5;">
                            Wedding celebrations in Jagadhri — please be sure you are with us.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 12px;border-bottom:1px solid #efe4cf;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">Wedding dinner</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1208;">12th August · Wednesday night</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;">Maple Garden · 8:00 PM onwards</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 12px;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">Anand Karaj &amp; brunch</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1208;">13th August · Thursday</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;">Morning ceremonies · blessings &amp; brunch</p>
                        </td>
                      </tr>`
      : `
                      <tr>
                        <td style="padding:14px 12px;border-bottom:1px solid #efe4cf;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">Start</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#1a1208;">11th August 2026</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;line-height:1.5;">
                            Wedding celebrations begin — please be sure you are with us.
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 12px;border-bottom:1px solid #efe4cf;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">Wedding dinner</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1208;">12th August · Wednesday night</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;">Maple Garden · 8:00 PM onwards</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:14px 12px;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">Anand Karaj &amp; brunch</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#1a1208;">13th August · Thursday</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;">Morning ceremonies · blessings &amp; brunch</p>
                        </td>
                      </tr>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3ebe0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f3ebe0;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#fffdf8;border-radius:24px;overflow:hidden;border:1px solid #e4d4b4;box-shadow:0 12px 40px rgba(80,55,20,0.08);">
          <tr>
            <td style="background:linear-gradient(160deg,#1a1208 0%,#3a2a14 48%,#6b4f1f 100%);padding:36px 28px 32px;text-align:center;">
              <p style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:#e8c97a;">
                ${escapeHtml(wedding.hashtag)}
              </p>
              <p style="margin:0 0 6px;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;color:#faf3e4;font-weight:400;">
                ${escapeHtml(wedding.couple.groom.firstName)}
                <span style="color:#d4af37;font-size:22px;">&amp;</span>
                ${escapeHtml(wedding.couple.bride.firstName)}
              </p>
              <p style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#f7e7c1;font-weight:400;">
                ${escapeHtml(headline)}
              </p>
              <p style="margin:10px auto 0;max-width:360px;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.55;color:#e8d9b5;">
                ${heroDates}
              </p>
            </td>
          </tr>
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#c9a227,#f0d78c,#c9a227);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:30px 28px 8px;font-family:Georgia,'Times New Roman',serif;color:#1a1208;">
              <p style="margin:0 0 14px;font-size:17px;line-height:1.6;">
                Dear <span style="color:#8a6d24;">${escapeHtml(greet)}</span>,
              </p>
              <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#3a3126;">
                ${escapeHtml(opening)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #e8dcc4;border-radius:18px;overflow:hidden;background:#fffaf0;">
                <tr>
                  <td style="padding:14px 20px;background:linear-gradient(90deg,#f3e6c8 0%,#faf4e6 100%);border-bottom:1px solid #e8dcc4;">
                    <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#8a6d24;font-weight:600;">
                      Celebration timeline
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 12px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${timelineRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f0e4;border-radius:16px;border:1px solid #e8dcc4;">
                <tr>
                  <td style="padding:16px 18px;font-family:Georgia,'Times New Roman',serif;">
                    <p style="margin:0 0 6px;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:#8a6d24;">Venue</p>
                    <p style="margin:0;font-size:16px;color:#1a1208;line-height:1.5;">${escapeHtml(venue)}</p>
                    <p style="margin:10px 0 0;">
                      <a href="${escapeHtml(mapsUrl)}" style="color:#8a6d24;font-size:14px;text-decoration:underline;">Open in Maps</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 6px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.7;color:#3a3126;">
              We would love your presence, your blessings, and your smiles. If anything has changed, kindly update your RSVP on the wedding site.
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 28px 10px;">
              <a href="${escapeHtml(siteUrl)}"
                 style="display:inline-block;background:linear-gradient(90deg,#1a1208,#3a2a14);color:#f7f1e6;padding:14px 28px;border-radius:999px;text-decoration:none;letter-spacing:0.14em;font-size:12px;text-transform:uppercase;font-family:Georgia,'Times New Roman',serif;border:1px solid #d4af37;">
                Open wedding site
              </a>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:6px 28px 8px;font-family:Georgia,'Times New Roman',serif;font-size:14px;">
              <a href="${escapeHtml(`${siteUrl}/wishes`)}" style="color:#8a6d24;text-decoration:none;padding:0 8px;">Leave a wish</a>
              <span style="color:#d4c4a0;">·</span>
              <a href="${escapeHtml(`${siteUrl}/upload`)}" style="color:#8a6d24;text-decoration:none;padding:0 8px;">Upload photos</a>
              <span style="color:#d4c4a0;">·</span>
              <a href="${escapeHtml(`${siteUrl}/gallery`)}" style="color:#8a6d24;text-decoration:none;padding:0 8px;">Gallery</a>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 32px;text-align:center;font-family:Georgia,'Times New Roman',serif;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:#b8922a;">With love</p>
              <p style="margin:0;font-size:22px;color:#1a1208;">
                ${escapeHtml(wedding.couple.groom.firstName)} &amp; ${escapeHtml(wedding.couple.bride.firstName)}
              </p>
              <p style="margin:10px 0 0;font-size:13px;letter-spacing:0.2em;color:#8a6d24;">
                ${escapeHtml(wedding.hashtag)}
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:11px;color:#9a8b76;text-align:center;">
          You are receiving this because you RSVP’d, booked a stay, left a wish, or joined #Swaneet online.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  return { subject, text, html };
}

export async function runAnnouncementEmail(input: {
  wave: AnnouncementWave;
  dryRun?: boolean;
  force?: boolean;
}): Promise<{
  wave: AnnouncementWave;
  dryRun: boolean;
  recipientCount: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
  recipients: Array<{
    email: string;
    name: string;
    sources: string[];
    site: FeatureSite;
    skipped?: string;
  }>;
}> {
  const dryRun = Boolean(input.dryRun);
  const force = Boolean(input.force);
  const recipients = await collectAnnouncementRecipients();
  const waveTag = `announcement:${input.wave}`;
  const scheduleBySite: Record<FeatureSite, ManagedEvent[]> = {
    main: await resolveAnnouncementScheduleEvents("main", input.wave),
    mehfil: await resolveAnnouncementScheduleEvents("mehfil", input.wave),
    laavan: await resolveAnnouncementScheduleEvents("laavan", input.wave),
  };

  /** Keyed by email::site so groom + bride sends for the same inbox stay independent */
  const alreadySent = new Set<string>();
  if (!force) {
    const logs = await listEmailLogs();
    const marker = announcementSubjectMarker("main", input.wave);
    for (const entry of logs) {
      if (entry.kind !== "announcement" || entry.status !== "sent") continue;
      const email = normalizeEmail(entry.to);
      if (!email) continue;
      const subject = entry.subject || "";
      if (input.wave === "apology") {
        // Apology content is the same full schedule for every site — one per inbox.
        if (subject.includes(marker)) {
          alreadySent.add(recipientKey(email, "main"));
          alreadySent.add(recipientKey(email, "mehfil"));
          alreadySent.add(recipientKey(email, "laavan"));
        }
        continue;
      }
      if (subject.includes(announcementSubjectMarker("mehfil", input.wave))) {
        alreadySent.add(recipientKey(email, "mehfil"));
      }
      if (
        subject.includes(announcementSubjectMarker("main", input.wave)) ||
        subject.includes(announcementSubjectMarker("laavan", input.wave))
      ) {
        alreadySent.add(recipientKey(email, "main"));
        alreadySent.add(recipientKey(email, "laavan"));
      }
    }
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];
  const summary: Array<{
    email: string;
    name: string;
    sources: string[];
    site: FeatureSite;
    skipped?: string;
  }> = [];
  /** Apology body is identical across sites — only one send per inbox in this run. */
  const seenEmailThisRun = new Set<string>();

  for (const guest of recipients) {
    const key = recipientKey(guest.email, guest.site);
    if (!force && alreadySent.has(key)) {
      skipped += 1;
      summary.push({
        email: guest.email,
        name: guest.name,
        sources: guest.sources,
        site: guest.site,
        skipped: `Already sent (${waveTag}/${guest.site})`,
      });
      continue;
    }

    if (input.wave === "apology" && seenEmailThisRun.has(guest.email)) {
      skipped += 1;
      summary.push({
        email: guest.email,
        name: guest.name,
        sources: guest.sources,
        site: guest.site,
        skipped: "Same inbox already queued for apology",
      });
      continue;
    }

    const parts = buildAnnouncementEmailParts({
      guestName: guest.name,
      wave: input.wave,
      site: guest.site,
      events: scheduleBySite[guest.site],
    });

    if (dryRun) {
      if (input.wave === "apology") seenEmailThisRun.add(guest.email);
      summary.push({
        email: guest.email,
        name: guest.name,
        sources: guest.sources,
        site: guest.site,
      });
      continue;
    }

    const result = await sendResendEmail({
      kind: "announcement",
      to: guest.email,
      subject: parts.subject,
      text: parts.text,
      html: parts.html,
    });

    if (result.ok) {
      sent += 1;
      if (input.wave === "apology") seenEmailThisRun.add(guest.email);
      summary.push({
        email: guest.email,
        name: guest.name,
        sources: guest.sources,
        site: guest.site,
      });
    } else {
      failed += 1;
      const message = result.error || "Send failed";
      errors.push(`${guest.email} (${guest.site}): ${message}`);
      summary.push({
        email: guest.email,
        name: guest.name,
        sources: guest.sources,
        site: guest.site,
        skipped: message,
      });
    }
  }

  return {
    wave: input.wave,
    dryRun,
    recipientCount: recipients.length,
    sent: dryRun ? 0 : sent,
    skipped,
    failed,
    errors,
    recipients: summary,
  };
}
