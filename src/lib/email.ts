import type {
  AccommodationRequest,
  AdminPermission,
  EmailKind,
  GalleryImage,
  ManagedEvent,
} from "@/lib/types";
import { PERMISSION_LABELS } from "@/lib/roles";
import { resolveEventsForStayEmail } from "@/lib/email-itinerary";
import { buildStayConfirmationParts } from "@/lib/email-stay-template";
import type { SharedRoomRoommateContact } from "@/lib/shared-room-email";
import { appendEmailLog } from "@/lib/store";

/** Default From for stay confirms, team invites, OTP, photo notes */
export const DEFAULT_EMAIL_FROM =
  "Swaneet Wedding <noreply@mail.technorapper.com>";

export function getEmailFrom() {
  return process.env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
}

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Make Resend domain / sandbox errors actionable for the dashboard */
export function friendlyResendError(message: string | undefined, status?: number) {
  const raw = message || (status ? `Email provider error (${status})` : "Email failed");
  if (/only send testing emails|verify a domain|resend\.dev/i.test(raw)) {
    return (
      "Email domain mail.technorapper.com is not ready in Resend yet. " +
      "Wait until it shows Verified at resend.com/domains, then try again."
    );
  }
  return raw;
}

function dashboardSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://swaneet.vercel.app")
  );
}

async function logEmail(input: {
  kind: EmailKind;
  to: string;
  subject: string;
  status: "sent" | "failed";
  error?: string;
}) {
  try {
    await appendEmailLog(input);
  } catch (error) {
    // Don't fail the send if logging fails — Resend may have already delivered
    console.error("appendEmailLog failed", error);
  }
}

/** Shared Resend send + dashboard email log */
export async function sendResendEmail(input: {
  kind: EmailKind;
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = getEmailFrom();
  const to = input.to.trim().toLowerCase();
  const subject = input.subject;

  if (!apiKey) {
    const error = "Email is not configured. Add RESEND_API_KEY in Vercel.";
    await logEmail({ kind: input.kind, to, subject, status: "failed", error });
    return { ok: false, error };
  }
  if (!to) {
    const error = "Email is required";
    await logEmail({ kind: input.kind, to: "", subject, status: "failed", error });
    return { ok: false, error };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    const error = friendlyResendError(body.message, response.status);
    await logEmail({ kind: input.kind, to, subject, status: "failed", error });
    return { ok: false, error };
  }

  await logEmail({ kind: input.kind, to, subject, status: "sent" });
  return { ok: true };
}

export async function sendAccommodationEmail(
  request: AccommodationRequest,
  options?: {
    /** Other guests in a shared room — phone + email for coordination */
    roommates?: SharedRoomRoommateContact[];
    /** Wedding events itinerary (loaded automatically when omitted) */
    events?: ManagedEvent[];
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = request.email || request.authEmail;
  const roommates = (options?.roommates || []).filter((r) => r.name?.trim());
  const sharingWith =
    roommates.map((r) => r.name).filter(Boolean).join(", ") ||
    request.roomShareWith?.filter(Boolean).join(", ") ||
    "";
  const isSharedRoom = Boolean(
    request.roomGroupId && (sharingWith || roommates.length > 0),
  );

  const subject =
    request.status === "confirmed"
      ? isSharedRoom
        ? "Your #Swaneet shared room details"
        : "Your #Swaneet accommodation details"
      : "Update on your #Swaneet accommodation request";

  if (!to) {
    const error = "This request has no email address to send to.";
    await logEmail({
      kind: "stay",
      to: "",
      subject,
      status: "failed",
      error,
    });
    return { ok: false, error };
  }

  const statusLine =
    request.status === "confirmed"
      ? isSharedRoom
        ? `You have been given a hotel room for #Swaneet. You will share this one room with ${sharingWith}.`
        : "Your stay has been confirmed."
      : request.status === "declined"
        ? "We’re unable to arrange accommodation for this request."
        : "Update on your accommodation request.";

  const events =
    options?.events ??
    (request.status === "confirmed"
      ? await resolveEventsForStayEmail(request)
      : []);

  const { text, html } = buildStayConfirmationParts({
    request,
    statusLine,
    isSharedRoom,
    roommates,
    events,
  });

  return sendResendEmail({
    kind: "stay",
    to,
    subject,
    text,
    html,
  });
}

export async function sendGuestPhotoRejectionEmail(
  image: Pick<
    GalleryImage,
    "alt" | "uploadedByEmail" | "uploadedByName"
  >,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = image.uploadedByEmail?.trim() || "";
  const subject = "A note about your #Swaneet photo";

  if (!to) {
    const error = "Guest has no email on this upload to notify.";
    await logEmail({
      kind: "photo_reject",
      to: "",
      subject,
      status: "failed",
      error,
    });
    return { ok: false, error };
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

  return sendResendEmail({
    kind: "photo_reject",
    to,
    subject,
    text,
    html,
  });
}

export async function sendTeamInviteEmail(input: {
  name: string;
  email: string;
  pin: string;
  permissions: AdminPermission[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const dashboardUrl = `${dashboardSiteUrl().replace(/\/$/, "")}/dashboard`;
  const accessList = input.permissions
    .map((p) => PERMISSION_LABELS[p] || p)
    .join(", ");
  const username = input.name.trim().split(/\s+/)[0] || input.name;

  const text = [
    `Dear ${input.name},`,
    "",
    "You’ve been added to the #Swaneet wedding dashboard team.",
    "",
    `Dashboard: ${dashboardUrl}`,
    `Username (first name): ${username}`,
    `Your PIN: ${input.pin}`,
    `Access: ${accessList}`,
    "",
    "Sign in with your first name + PIN. Please keep this PIN private.",
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
      <p><strong>Username (first name):</strong> ${escapeHtml(username)}</p>
      <p><strong>Your PIN:</strong> ${escapeHtml(input.pin)}</p>
      <p><strong>Access:</strong> ${escapeHtml(accessList)}</p>
      <p>Sign in with your first name + PIN. Please keep this PIN private.</p>
      <p>With love,<br/>Haneet &amp; Swarandeep</p>
    </div>
  `;

  return sendResendEmail({
    kind: "team_invite",
    to: input.email,
    subject: "Your #Swaneet dashboard access",
    text,
    html,
  });
}

/** Notify a team member after their role / PIN / active status changes */
export async function sendTeamUpdateEmail(input: {
  name: string;
  email: string;
  permissions: AdminPermission[];
  active: boolean;
  /** Only include when a new PIN was set */
  newPin?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const dashboardUrl = `${dashboardSiteUrl().replace(/\/$/, "")}/dashboard`;
  const accessList = input.permissions
    .map((p) => PERMISSION_LABELS[p] || p)
    .join(", ");

  const statusLine = input.active
    ? "Your #Swaneet dashboard access was updated."
    : "Your #Swaneet dashboard access has been paused.";

  const textParts = [
    `Dear ${input.name},`,
    "",
    statusLine,
    "",
    `Dashboard: ${dashboardUrl}`,
    `Username (first name): ${input.name.trim().split(/\s+/)[0] || input.name}`,
    `Access: ${accessList}`,
    `Status: ${input.active ? "Active" : "Paused"}`,
  ];
  if (input.newPin) {
    textParts.push(`Your new PIN: ${input.newPin}`, "Please keep this PIN private.");
  } else if (input.active) {
    textParts.push("Your existing PIN is unchanged.");
  }
  textParts.push("", "With love,", "#Swaneet · Haneet & Swarandeep");
  const text = textParts.join("\n");

  const pinHtml = input.newPin
    ? `<p><strong>Your new PIN:</strong> ${escapeHtml(input.newPin)}</p><p>Please keep this PIN private.</p>`
    : input.active
      ? `<p>Your existing PIN is unchanged.</p>`
      : "";

  const username = input.name.trim().split(/\s+/)[0] || input.name;

  const html = `
    <div style="font-family: Georgia, serif; color: #1a1208; line-height: 1.6; max-width: 560px;">
      <p style="letter-spacing: 0.2em; text-transform: uppercase; font-size: 11px; color: #b8922a;">#Swaneet</p>
      <h1 style="font-weight: 400; font-size: 28px;">Access update</h1>
      <p>Dear ${escapeHtml(input.name)},</p>
      <p>${escapeHtml(statusLine)}</p>
      <p><strong>Dashboard:</strong> <a href="${escapeHtml(dashboardUrl)}">${escapeHtml(dashboardUrl)}</a></p>
      <p><strong>Username (first name):</strong> ${escapeHtml(username)}</p>
      <p><strong>Access:</strong> ${escapeHtml(accessList)}</p>
      <p><strong>Status:</strong> ${input.active ? "Active" : "Paused"}</p>
      ${pinHtml}
      <p>With love,<br/>Haneet &amp; Swarandeep</p>
    </div>
  `;

  return sendResendEmail({
    kind: "team_update",
    to: input.email,
    subject: input.active
      ? "Your #Swaneet dashboard access was updated"
      : "Your #Swaneet dashboard access was paused",
    text,
    html,
  });
}

/** Where guest activity alerts are sent (RSVP, stay, photos) */
export const OWNER_NOTIFY_EMAIL =
  process.env.OWNER_NOTIFY_EMAIL?.trim() || "haneet555@gmail.com";

/** Alert family inbox when guests RSVP / request stay / share photos */
export async function notifyOwner(input: {
  title: string;
  summary: string;
  details: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const lines = input.details.filter(Boolean);
  const text = [
    input.summary,
    "",
    ...lines,
    "",
    "Open the dashboard: https://swaneet.vercel.app/dashboard",
    "",
    "#Swaneet",
  ].join("\n");

  const html = `
    <div style="font-family: Georgia, serif; color: #1a1208; line-height: 1.6; max-width: 560px;">
      <p style="letter-spacing: 0.2em; text-transform: uppercase; font-size: 11px; color: #b8922a;">#Swaneet</p>
      <h1 style="font-weight: 400; font-size: 26px;">${escapeHtml(input.title)}</h1>
      <p>${escapeHtml(input.summary)}</p>
      <pre style="white-space: pre-wrap; font-family: Georgia, serif; background: #f7f1e6; padding: 16px; border-radius: 12px;">${escapeHtml(lines.join("\n"))}</pre>
      <p><a href="https://swaneet.vercel.app/dashboard">Open dashboard</a></p>
    </div>
  `;

  return sendResendEmail({
    kind: "owner_alert",
    to: OWNER_NOTIFY_EMAIL,
    subject: `[#Swaneet] ${input.title}`,
    text,
    html,
  });
}

/** Email a guest a private link to their matched wedding photos. */
export async function sendFacePhotosLinkEmail(input: {
  to: string;
  name?: string;
  albumUrl: string;
  photoCount?: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const greet = input.name?.trim() ? input.name.trim() : "there";
  const count =
    typeof input.photoCount === "number" && input.photoCount > 0
      ? `${input.photoCount} photo${input.photoCount === 1 ? "" : "s"}`
      : "your wedding photos";
  const subject = "Your #Swaneet wedding photos";
  const text = [
    `Hi ${greet},`,
    "",
    `Your photos from #Swaneet are ready — ${count}.`,
    "",
    `Open your private album (link valid 14 days):`,
    input.albumUrl,
    "",
    "You can also find more anytime at the site: sign in with Google and upload a selfie on /my-photos.",
    "",
    "#Swaneet",
  ].join("\n");

  const html = `
    <div style="font-family: Georgia, serif; color: #1a1208; line-height: 1.6; max-width: 560px;">
      <p style="letter-spacing: 0.2em; text-transform: uppercase; font-size: 11px; color: #b8922a;">#Swaneet</p>
      <h1 style="font-weight: 400; font-size: 26px;">Your wedding photos</h1>
      <p>Hi ${escapeHtml(greet)},</p>
      <p>Your photos from #Swaneet are ready — ${escapeHtml(count)}.</p>
      <p style="margin: 28px 0;">
        <a href="${escapeHtml(input.albumUrl)}"
           style="display:inline-block;background:#1a1208;color:#f7f1e6;padding:12px 22px;border-radius:999px;text-decoration:none;letter-spacing:0.08em;font-size:13px;text-transform:uppercase;">
          Open my photos
        </a>
      </p>
      <p style="font-size: 13px; color: #6b5c4a;">This private link works for 14 days. You can also sign in on the website and upload a selfie under Find my photos.</p>
    </div>
  `;

  return sendResendEmail({
    kind: "face_photos",
    to: input.to,
    subject,
    text,
    html,
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
