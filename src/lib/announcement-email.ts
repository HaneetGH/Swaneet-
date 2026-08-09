import { sendResendEmail } from "@/lib/email";
import { resolveEntryInviteSite } from "@/lib/rsvp-days";
import {
  listAccommodations,
  listEmailLogs,
  listGuestLogins,
  listGuestMessages,
  listRsvps,
} from "@/lib/store";
import type { FeatureSite } from "@/lib/types";
import { wedding } from "@/data/wedding";

export type AnnouncementWave = "today" | "tomorrow";

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
}): { subject: string; text: string; html: string } {
  const site = input.site || "main";
  const includeSangeet = announcementIncludesSangeet(site);
  const greet = input.guestName.trim() || "Friend";
  const siteUrl = siteBaseUrl();
  const venue = wedding.venue.fullAddress;

  const subject = includeSangeet
    ? input.wave === "tomorrow"
      ? `Reminder · Sangeet & wedding from 11th August — please be with us · ${wedding.hashtag}`
      : `Sangeet · Wedding from 11th August — please be with us · ${wedding.hashtag}`
    : input.wave === "tomorrow"
      ? `Reminder · Celebrations begin from 11th August — please be with us · ${wedding.hashtag}`
      : `Celebrations begin from 11th August — please be with us · ${wedding.hashtag}`;

  const opening = includeSangeet
    ? input.wave === "tomorrow"
      ? "A warm reminder as we get closer — our #Swaneet celebrations include Sangeet on 9th August in Panipat, then wedding days from 11th August. Please make sure you are with us."
      : "With love from both families — our #Swaneet celebrations include Sangeet on 9th August in Panipat, then wedding days from 11th August. Please make sure you are with us for the days ahead."
    : input.wave === "tomorrow"
      ? "A warm reminder as we get closer — our #Swaneet celebrations begin from 11th August. Please make sure you are with us."
      : "With love from both families — our #Swaneet celebrations begin from 11th August. Please make sure you are with us for the days ahead.";

  const scheduleLines = [
    ...(includeSangeet
      ? ["9th August (Sunday night) — Sangeet in Panipat · 8:00 PM."]
      : []),
    includeSangeet
      ? "From 11th August 2026 — wedding celebrations continue. Kindly plan to be present."
      : "From 11th August 2026 — wedding celebrations begin. Kindly plan to be present.",
    "12th August (Wednesday night) — Wedding Dinner at Maple Garden.",
    "13th August (Thursday) — Anand Karaj & Brunch.",
  ];

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

  const headline =
    input.wave === "tomorrow" ? "A gentle reminder" : "Please be with us";
  const mapsUrl =
    wedding.venue.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wedding.venue.mapQuery)}`;

  const heroDates = includeSangeet
    ? `Sangeet on <strong style="color:#fff8e8;">9th August</strong>
                · Wedding from <strong style="color:#fff8e8;">11th August 2026</strong>`
    : `Celebrations begin from <strong style="color:#fff8e8;">11th August 2026</strong>`;

  const sangeetRow = includeSangeet
    ? `
                      <tr>
                        <td style="padding:14px 12px;border-bottom:1px solid #efe4cf;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">Sangeet</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#1a1208;">9th August 2026 · Sunday night</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;line-height:1.5;">
                            Panipat · 8:00 PM — music, dance, and celebration with both families.
                          </p>
                        </td>
                      </tr>`
    : "";

  const startLabel = includeSangeet ? "Wedding days" : "Start";
  const startDetail = includeSangeet
    ? "Wedding celebrations continue in Jagadhri — please be sure you are with us."
    : "Wedding celebrations begin — please be sure you are with us.";

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
                      ${sangeetRow}
                      <tr>
                        <td style="padding:14px 12px;border-bottom:1px solid #efe4cf;">
                          <p style="margin:0 0 4px;font-family:Georgia,'Times New Roman',serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">${escapeHtml(startLabel)}</p>
                          <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;color:#1a1208;">11th August 2026</p>
                          <p style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:14px;color:#6b5c4a;line-height:1.5;">
                            ${escapeHtml(startDetail)}
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
                      </tr>
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

  /** Keyed by email::site so groom + bride sends for the same inbox stay independent */
  let alreadySent = new Set<string>();
  if (!force) {
    const logs = await listEmailLogs();
    for (const entry of logs) {
      if (entry.kind !== "announcement" || entry.status !== "sent") continue;
      const email = normalizeEmail(entry.to);
      if (!email) continue;
      const subject = entry.subject || "";
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

    const parts = buildAnnouncementEmailParts({
      guestName: guest.name,
      wave: input.wave,
      site: guest.site,
    });

    if (dryRun) {
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
