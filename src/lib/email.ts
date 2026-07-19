import type {
  AccommodationRequest,
  AdminPermission,
  GalleryImage,
} from "@/lib/types";
import { PERMISSION_LABELS } from "@/lib/roles";

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** Make Resend sandbox / domain errors actionable for the dashboard */
export function friendlyResendError(message: string | undefined, status?: number) {
  const raw = message || (status ? `Email provider error (${status})` : "Email failed");
  if (/only send testing emails|verify a domain|resend\.dev/i.test(raw)) {
    return (
      "Resend domain is not verified yet. " +
      "In Resend → Domains, wait until mail.technorapper.com shows Verified, " +
      "then confirm EMAIL_FROM is Swaneet Wedding <noreply@mail.technorapper.com> on Vercel and redeploy."
    );
  }
  return raw;
}

export async function sendAccommodationEmail(
  request: AccommodationRequest,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = request.email || request.authEmail;

  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "Email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Vercel.",
    };
  }
  if (!to) {
    return { ok: false, error: "This request has no email address to send to." };
  }

  const statusLine =
    request.status === "confirmed"
      ? "Your stay has been confirmed."
      : request.status === "declined"
        ? "We’re unable to arrange accommodation for this request."
        : "Update on your accommodation request.";

  const details =
    request.status === "confirmed"
      ? [
          request.hotelName ? `Hotel / stay: ${request.hotelName}` : null,
          request.hotelAddress ? `Address: ${request.hotelAddress}` : null,
          request.roomDetails ? `Room details: ${request.roomDetails}` : null,
          `Check-in: ${formatDate(request.checkIn)}`,
          `Check-out: ${formatDate(request.checkOut)}`,
          `Guests: ${request.people} · Rooms: ${request.rooms}`,
          request.adminNotes ? `Notes from family: ${request.adminNotes}` : null,
        ]
          .filter(Boolean)
          .join("\n")
      : [
          `Requested: ${formatDate(request.checkIn)} → ${formatDate(request.checkOut)}`,
          `Guests: ${request.people} · Rooms: ${request.rooms}`,
          request.adminNotes ? `Message: ${request.adminNotes}` : null,
        ]
          .filter(Boolean)
          .join("\n");

  const text = [
    `Dear ${request.name},`,
    "",
    statusLine,
    "",
    details,
    "",
    "With love,",
    "#Swaneet · Haneet & Swarandeep",
  ].join("\n");

  const html = `
    <div style="font-family: Georgia, serif; color: #1a1208; line-height: 1.6; max-width: 560px;">
      <p style="letter-spacing: 0.2em; text-transform: uppercase; font-size: 11px; color: #b8922a;">#Swaneet</p>
      <h1 style="font-weight: 400; font-size: 28px;">Accommodation update</h1>
      <p>Dear ${escapeHtml(request.name)},</p>
      <p>${escapeHtml(statusLine)}</p>
      <pre style="white-space: pre-wrap; font-family: Georgia, serif; background: #f7f1e6; padding: 16px; border-radius: 12px;">${escapeHtml(details)}</pre>
      <p>With love,<br/>Haneet &amp; Swarandeep</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject:
        request.status === "confirmed"
          ? "Your #Swaneet accommodation details"
          : "Update on your #Swaneet accommodation request",
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    return {
      ok: false,
      error: friendlyResendError(body.message, response.status),
    };
  }

  return { ok: true };
}

export async function sendGuestPhotoRejectionEmail(
  image: Pick<
    GalleryImage,
    "alt" | "uploadedByEmail" | "uploadedByName"
  >,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = image.uploadedByEmail?.trim();

  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "Email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Vercel.",
    };
  }
  if (!to) {
    return {
      ok: false,
      error: "Guest has no email on this upload to notify.",
    };
  }

  const name = image.uploadedByName?.trim() || "Guest";
  const caption = image.alt?.trim() || "your photo";

  const text = [
    `Dear ${name},`,
    "",
    "Thank you for sharing a moment with #Swaneet.",
    "",
    `We’re sorry — we weren’t able to include “${caption}” in the wedding gallery this time.`,
    "",
    "Please don’t take it to heart. Your love and blessings mean the world to us, and we’re grateful you thought of us.",
    "",
    "With love,",
    "#Swaneet · Haneet & Swarandeep",
  ].join("\n");

  const html = `
    <div style="font-family: Georgia, serif; color: #1a1208; line-height: 1.6; max-width: 560px;">
      <p style="letter-spacing: 0.2em; text-transform: uppercase; font-size: 11px; color: #b8922a;">#Swaneet</p>
      <h1 style="font-weight: 400; font-size: 28px;">A note about your photo</h1>
      <p>Dear ${escapeHtml(name)},</p>
      <p>Thank you for sharing a moment with us.</p>
      <p>We’re sorry — we weren’t able to include <em>${escapeHtml(caption)}</em> in the wedding gallery this time.</p>
      <p>Please don’t take it to heart. Your love and blessings mean the world to us, and we’re grateful you thought of us.</p>
      <p>With love,<br/>Haneet &amp; Swarandeep</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "A note about your #Swaneet photo",
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    return {
      ok: false,
      error: friendlyResendError(body.message, response.status),
    };
  }

  return { ok: true };
}

export async function sendTeamInviteEmail(input: {
  name: string;
  email: string;
  pin: string;
  permissions: AdminPermission[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const to = input.email.trim().toLowerCase();

  if (!apiKey || !from) {
    return {
      ok: false,
      error:
        "Email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Vercel.",
    };
  }
  if (!to) {
    return { ok: false, error: "Email is required" };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://swaneet.vercel.app");
  const dashboardUrl = `${siteUrl.replace(/\/$/, "")}/dashboard`;
  const accessList = input.permissions
    .map((p) => PERMISSION_LABELS[p] || p)
    .join(", ");

  const text = [
    `Dear ${input.name},`,
    "",
    "You’ve been added to the #Swaneet wedding dashboard team.",
    "",
    `Dashboard: ${dashboardUrl}`,
    `Your PIN: ${input.pin}`,
    `Access: ${accessList}`,
    "",
    "Please keep this PIN private. You can sign in at the dashboard link above.",
    "",
    "With love,",
    "#Swaneet · Haneet & Swarandeep",
  ].join("\n");

  const html = `
    <div style="font-family: Georgia, serif; color: #1a1208; line-height: 1.6; max-width: 560px;">
      <p style="letter-spacing: 0.2em; text-transform: uppercase; font-size: 11px; color: #b8922a;">#Swaneet</p>
      <h1 style="font-weight: 400; font-size: 28px;">Dashboard access</h1>
      <p>Dear ${escapeHtml(input.name)},</p>
      <p>You’ve been added to the wedding dashboard team.</p>
      <p><strong>Dashboard:</strong> <a href="${escapeHtml(dashboardUrl)}">${escapeHtml(dashboardUrl)}</a></p>
      <p><strong>Your PIN:</strong> ${escapeHtml(input.pin)}</p>
      <p><strong>Access:</strong> ${escapeHtml(accessList)}</p>
      <p>Please keep this PIN private.</p>
      <p>With love,<br/>Haneet &amp; Swarandeep</p>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your #Swaneet dashboard access",
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    return {
      ok: false,
      error: friendlyResendError(body.message, response.status),
    };
  }

  return { ok: true };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
