import { sendResendEmail } from "@/lib/email";
import {
  listAccommodations,
  listEmailLogs,
  listGuestLogins,
  listGuestMessages,
  listRsvps,
} from "@/lib/store";
import { wedding } from "@/data/wedding";

export type AnnouncementWave = "today" | "tomorrow";

export type AnnouncementSource = "rsvp" | "stay" | "wish" | "login";

export type AnnouncementRecipient = {
  email: string;
  name: string;
  sources: AnnouncementSource[];
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

function upsertRecipient(
  byEmail: Map<string, AnnouncementRecipient>,
  input: { email?: string | null; name?: string | null; source: AnnouncementSource },
) {
  const email = normalizeEmail(input.email);
  if (!email) return;
  const name = (input.name || "").trim();
  const existing = byEmail.get(email);
  if (existing) {
    if (!existing.sources.includes(input.source)) {
      existing.sources.push(input.source);
    }
    if ((!existing.name || existing.name === "Guest") && name) {
      existing.name = name;
    }
    return;
  }
  byEmail.set(email, {
    email,
    name: name || "Guest",
    sources: [input.source],
  });
}

/**
 * Unique guests with an email from:
 * RSVP (not “no”), stay (not declined), wishes (real guest posts), and site logins.
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
  const byEmail = new Map<string, AnnouncementRecipient>();

  for (const rsvp of rsvps) {
    if (rsvp.attendance === "no") continue;
    upsertRecipient(byEmail, {
      email: rsvp.email || rsvp.authEmail,
      name: rsvp.name,
      source: "rsvp",
    });
  }

  for (const stay of stays) {
    if (stay.status === "declined") continue;
    if (stay.offerStatus === "declined") continue;
    upsertRecipient(byEmail, {
      email: stay.email || stay.authEmail,
      name: stay.name,
      source: "stay",
    });
  }

  for (const wish of wishes) {
    if (wish.source === "sample") continue;
    if (wish.status === "rejected") continue;
    upsertRecipient(byEmail, {
      email: wish.authEmail,
      name: wish.displayName,
      source: "wish",
    });
  }

  for (const login of logins) {
    upsertRecipient(byEmail, {
      email: login.email,
      name: login.name,
      source: "login",
    });
  }

  return [...byEmail.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "en"),
  );
}

export function buildAnnouncementEmailParts(input: {
  guestName: string;
  wave: AnnouncementWave;
}): { subject: string; text: string; html: string } {
  const greet = input.guestName.trim() || "Friend";
  const siteUrl = siteBaseUrl();
  const venue = wedding.venue.fullAddress;

  const subject =
    input.wave === "tomorrow"
      ? `Reminder · Celebrations begin from 11th August — please be with us · ${wedding.hashtag}`
      : `Celebrations begin from 11th August — please be with us · ${wedding.hashtag}`;

  const opening =
    input.wave === "tomorrow"
      ? "A warm reminder as we get closer — our #Swaneet celebrations begin from 11th August. Please make sure you are with us."
      : "With love from both families — our #Swaneet celebrations begin from 11th August. Please make sure you are with us for the days ahead.";

  const scheduleLines = [
    "From 11th August 2026 — wedding celebrations begin. Kindly plan to be present.",
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

  const html = `
    <div style="font-family: Georgia, serif; color: #1a1208; line-height: 1.65; max-width: 560px;">
      <p style="letter-spacing: 0.22em; text-transform: uppercase; font-size: 11px; color: #b8922a; margin: 0 0 8px;">
        ${escapeHtml(wedding.hashtag)}
      </p>
      <h1 style="font-weight: 400; font-size: 28px; margin: 0 0 16px; color: #1a1208;">
        ${
          input.wave === "tomorrow"
            ? "A gentle reminder"
            : "Please be with us"
        }
      </h1>
      <p>Dear ${escapeHtml(greet)},</p>
      <p>${escapeHtml(opening)}</p>
      <div style="margin: 22px 0; border: 1px solid #e8dcc4; border-radius: 16px; overflow: hidden; background: #fffdf8;">
        <div style="padding: 12px 18px; background: linear-gradient(90deg, #f3e6c8 0%, #faf4e6 100%); border-bottom: 1px solid #e8dcc4;">
          <p style="margin: 0; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6d24; font-weight: 600;">
            Important dates
          </p>
        </div>
        <div style="padding: 16px 18px;">
          <p style="margin: 0 0 12px; font-size: 16px; color: #2a2118;">
            <strong>From 11th August 2026</strong> — celebrations begin.<br/>
            <span style="font-size: 14px; color: #6b5c4a;">Please be sure you are here for them.</span>
          </p>
          <p style="margin: 0 0 8px; font-size: 15px; color: #2a2118;">
            <strong>12th August</strong> · Wednesday night · Wedding Dinner
          </p>
          <p style="margin: 0; font-size: 15px; color: #2a2118;">
            <strong>13th August</strong> · Thursday · Anand Karaj &amp; Brunch
          </p>
          <p style="margin: 14px 0 0; font-size: 13px; color: #6b5c4a;">
            ${escapeHtml(venue)}
          </p>
        </div>
      </div>
      <p>We would love your presence, your blessings, and your smiles. If anything has changed, kindly update your RSVP on the wedding site.</p>
      <p style="margin: 22px 0 10px;">
        <a href="${escapeHtml(siteUrl)}"
           style="display:inline-block;background:#1a1208;color:#f7f1e6;padding:11px 20px;border-radius:999px;text-decoration:none;letter-spacing:0.08em;font-size:12px;text-transform:uppercase;">
          Open wedding site
        </a>
      </p>
      <p style="margin: 0 0 8px;">
        <a href="${escapeHtml(`${siteUrl}/wishes`)}" style="color:#8a6d24;">Leave a wish</a>
        &nbsp;·&nbsp;
        <a href="${escapeHtml(`${siteUrl}/upload`)}" style="color:#8a6d24;">Upload photos</a>
      </p>
      <p style="margin-top: 24px;">With love,<br/>Haneet &amp; Swarandeep<br/>${escapeHtml(wedding.hashtag)}</p>
    </div>
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
  recipients: Array<{ email: string; name: string; sources: string[]; skipped?: string }>;
}> {
  const dryRun = Boolean(input.dryRun);
  const force = Boolean(input.force);
  const recipients = await collectAnnouncementRecipients();
  const waveTag = `announcement:${input.wave}`;

  let alreadySent = new Set<string>();
  if (!force) {
    const logs = await listEmailLogs();
    alreadySent = new Set(
      logs
        .filter(
          (entry) =>
            entry.kind === "announcement" &&
            entry.status === "sent" &&
            entry.subject.includes(
              input.wave === "tomorrow" ? "Reminder ·" : "Celebrations begin",
            ),
        )
        .map((entry) => normalizeEmail(entry.to)),
    );
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];
  const summary: Array<{
    email: string;
    name: string;
    sources: string[];
    skipped?: string;
  }> = [];

  for (const guest of recipients) {
    if (!force && alreadySent.has(guest.email)) {
      skipped += 1;
      summary.push({
        email: guest.email,
        name: guest.name,
        sources: guest.sources,
        skipped: `Already sent (${waveTag})`,
      });
      continue;
    }

    const parts = buildAnnouncementEmailParts({
      guestName: guest.name,
      wave: input.wave,
    });

    if (dryRun) {
      summary.push({
        email: guest.email,
        name: guest.name,
        sources: guest.sources,
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
      });
    } else {
      failed += 1;
      const message = result.error || "Send failed";
      errors.push(`${guest.email}: ${message}`);
      summary.push({
        email: guest.email,
        name: guest.name,
        sources: guest.sources,
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
