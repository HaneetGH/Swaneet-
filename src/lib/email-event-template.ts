import { googleCalendarUrl } from "@/lib/calendar";
import { eventMapsUrl } from "@/lib/email-itinerary";
import type { ManagedEvent } from "@/lib/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type EventEmailLink = {
  label: string;
  url: string;
  hint?: string;
};

export type EventEmailPartsInput = {
  guestName: string;
  todayLabel: string;
  tomorrowLabel: string;
  todayEvents: ManagedEvent[];
  tomorrowEvents: ManagedEvent[];
  links: EventEmailLink[];
};

function formatEventBlock(event: ManagedEvent, index: number): string {
  const venueLine = [event.venue, event.venueDetail]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
  const maps = eventMapsUrl(event);
  const cal = googleCalendarUrl(event);
  return [
    `${index + 1}. ${event.name}`,
    `   When: ${event.day}${event.day && event.date ? ", " : ""}${event.date} · ${event.time}`,
    venueLine ? `   Venue: ${venueLine}` : null,
    event.address?.trim() ? `   Location: ${event.address.trim()}` : null,
    maps ? `   Maps: ${maps}` : null,
    cal ? `   Calendar: ${cal}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function formatEventHtml(event: ManagedEvent): string {
  const venueLine = [event.venue, event.venueDetail]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ");
  const maps = eventMapsUrl(event);
  const cal = googleCalendarUrl(event);
  const links = [
    maps
      ? `<a href="${escapeHtml(maps)}" style="color:#8a6d24;">Maps</a>`
      : null,
    cal
      ? `<a href="${escapeHtml(cal)}" style="color:#8a6d24;">Add to calendar</a>`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return `
    <div style="margin: 0 0 14px; padding-bottom: 14px; border-bottom: 1px solid #efe4cf;">
      <p style="margin: 0 0 4px; font-size: 18px; color: #2a2118;">${escapeHtml(event.name)}</p>
      <p style="margin: 0; font-size: 14px; color: #6b5c4a;">
        ${escapeHtml(event.day)}${event.day && event.date ? " · " : ""}${escapeHtml(event.date)} · ${escapeHtml(event.time)}
      </p>
      ${
        venueLine
          ? `<p style="margin: 6px 0 0; font-size: 14px; color: #2a2118;">${escapeHtml(venueLine)}</p>`
          : ""
      }
      ${
        event.address?.trim()
          ? `<p style="margin: 2px 0 0; font-size: 13px; color: #6b5c4a;">${escapeHtml(event.address.trim())}</p>`
          : ""
      }
      ${links ? `<p style="margin: 8px 0 0; font-size: 13px;">${links}</p>` : ""}
    </div>`;
}

function sectionCard(title: string, events: ManagedEvent[]): string {
  return `
    <div style="margin: 22px 0; border: 1px solid #e8dcc4; border-radius: 16px; overflow: hidden; background: #fffdf8;">
      <div style="padding: 12px 18px; background: linear-gradient(90deg, #f3e6c8 0%, #faf4e6 100%); border-bottom: 1px solid #e8dcc4;">
        <p style="margin: 0; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6d24; font-weight: 600;">
          ${escapeHtml(title)}
        </p>
      </div>
      <div style="padding: 16px 18px;">
        ${
          events.length
            ? events.map(formatEventHtml).join("")
            : "<p style='margin:0;color:#6b5c4a;'>No events listed</p>"
        }
      </div>
    </div>`;
}

/** Evening digest: thank-you for today + tomorrow’s schedule + links. */
export function buildEventEmailParts(input: EventEmailPartsInput): {
  subject: string;
  text: string;
  html: string;
} {
  const greet = input.guestName.trim() || "Friend";
  const hasToday = input.todayEvents.length > 0;
  const hasTomorrow = input.tomorrowEvents.length > 0;

  const subjectBits = [
    hasToday ? "Thank you for today" : null,
    hasTomorrow
      ? `Tomorrow: ${input.tomorrowEvents.map((e) => e.name).join(", ")}`
      : null,
  ].filter(Boolean);
  const subject = `${subjectBits.join(" · ") || "Your #Swaneet update"} · #Swaneet`;

  const introParts = [
    hasToday
      ? `Thank you for being part of today’s celebrations (${input.todayLabel}). Your presence made #Swaneet brighter.`
      : null,
    hasTomorrow
      ? `Here’s what’s coming tomorrow (${input.tomorrowLabel}).`
      : null,
    !hasToday && !hasTomorrow
      ? "A quick update from #Swaneet — with love from the families."
      : null,
  ].filter((part): part is string => Boolean(part));

  const todayText = hasToday
    ? [
        `Today’s events (${input.todayLabel}):`,
        input.todayEvents.map(formatEventBlock).join("\n\n"),
      ].join("\n")
    : "";

  const tomorrowText = hasTomorrow
    ? [
        `Tomorrow’s events (${input.tomorrowLabel}):`,
        input.tomorrowEvents.map(formatEventBlock).join("\n\n"),
      ].join("\n")
    : "";

  const linksText = input.links
    .map((link) =>
      link.hint
        ? `• ${link.label}: ${link.url}\n  ${link.hint}`
        : `• ${link.label}: ${link.url}`,
    )
    .join("\n");

  const text = [
    `Dear ${greet},`,
    "",
    ...introParts,
    "",
    todayText,
    todayText && tomorrowText ? "" : null,
    tomorrowText,
    "",
    "Quick links:",
    linksText || "• Open the wedding site",
    "",
    "Share a photo, browse the gallery, or leave a wish for the couple whenever you’re ready.",
    "",
    "#Swaneet · Haneet & Swarandeep",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const linkButtons = input.links
    .map(
      (link) => `
      <p style="margin: 0 0 10px;">
        <a href="${escapeHtml(link.url)}"
           style="display:inline-block;background:#1a1208;color:#f7f1e6;padding:10px 18px;border-radius:999px;text-decoration:none;letter-spacing:0.06em;font-size:12px;text-transform:uppercase;">
          ${escapeHtml(link.label)}
        </a>
        ${
          link.hint
            ? `<span style="display:block;margin-top:4px;font-size:12px;color:#6b5c4a;">${escapeHtml(link.hint)}</span>`
            : ""
        }
      </p>`,
    )
    .join("");

  const html = `
    <div style="font-family: Georgia, serif; color: #1a1208; line-height: 1.6; max-width: 560px;">
      <p style="letter-spacing: 0.2em; text-transform: uppercase; font-size: 11px; color: #b8922a;">#Swaneet</p>
      <h1 style="font-weight: 400; font-size: 28px; margin: 8px 0 16px;">
        Your evening update
      </h1>
      <p>Dear ${escapeHtml(greet)},</p>
      ${introParts.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
      ${
        hasToday
          ? sectionCard(`Today · ${input.todayLabel}`, input.todayEvents)
          : ""
      }
      ${
        hasTomorrow
          ? sectionCard(`Tomorrow · ${input.tomorrowLabel}`, input.tomorrowEvents)
          : ""
      }
      <p style="font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #8a6d24; margin: 0 0 12px;">
        Quick links
      </p>
      ${linkButtons}
      <p style="margin-top: 22px;">Share a photo, browse the gallery, or leave a wish for the couple whenever you’re ready.</p>
      <p>With love,<br/>Haneet &amp; Swarandeep</p>
    </div>
  `;

  return { subject, text, html };
}
