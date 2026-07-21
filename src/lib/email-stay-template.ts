import {
  eventMapsUrl,
  filterUpcomingEvents,
  formatEventsItinerary,
} from "@/lib/email-itinerary";
import type { SharedRoomRoommateContact } from "@/lib/shared-room-email";
import type { AccommodationRequest, ManagedEvent } from "@/lib/types";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatStayDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function detailRow(label: string, value: string) {
  return `
    <tr>
      <td style="padding: 8px 0; vertical-align: top; width: 110px; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #9a7b2f;">
        ${escapeHtml(label)}
      </td>
      <td style="padding: 8px 0; vertical-align: top; font-size: 15px; color: #2a2118;">
        ${escapeHtml(value)}
      </td>
    </tr>`;
}

function sectionCard(title: string, bodyHtml: string) {
  return `
    <div style="margin: 0 0 18px; border: 1px solid #e8dcc4; border-radius: 16px; overflow: hidden; background: #fffdf8;">
      <div style="padding: 12px 18px; background: linear-gradient(90deg, #f3e6c8 0%, #faf4e6 100%); border-bottom: 1px solid #e8dcc4;">
        <p style="margin: 0; font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: #8a6d24; font-weight: 600;">
          ${escapeHtml(title)}
        </p>
      </div>
      <div style="padding: 16px 18px;">
        ${bodyHtml}
      </div>
    </div>`;
}

export function buildStayConfirmationParts(input: {
  request: AccommodationRequest;
  statusLine: string;
  isSharedRoom: boolean;
  roommates: SharedRoomRoommateContact[];
  events: ManagedEvent[];
}): { text: string; html: string } {
  const { request, statusLine, isSharedRoom, roommates } = input;
  const events = filterUpcomingEvents(input.events);
  const title = isSharedRoom ? "Your shared room" : "Your hotel details";

  const textRoommate =
    isSharedRoom && roommates.length
      ? [
          "Important: one room is shared — please coordinate with the others.",
          "Roommate contacts:",
          ...roommates.map((mate) => {
            const parts = [
              mate.name,
              mate.phone ? `Phone: ${mate.phone}` : null,
              mate.email ? `Email: ${mate.email}` : null,
            ].filter(Boolean);
            return `• ${parts.join(" · ")}`;
          }),
        ].join("\n")
      : isSharedRoom
        ? `You are sharing with: ${(request.roomShareWith || []).join(", ")}`
        : typeof request.roomsAssigned === "number" && request.roomsAssigned > 0
          ? `Rooms arranged for you: ${request.roomsAssigned}`
          : `Guests: ${request.people} · Rooms requested: ${request.rooms}`;

  const itineraryText = formatEventsItinerary(events);

  const textDetails =
    request.status === "confirmed"
      ? [
          request.hotelName ? `Hotel / stay: ${request.hotelName}` : null,
          request.hotelAddress ? `Address: ${request.hotelAddress}` : null,
          request.roomDetails
            ? `Room / hotel details:\n${request.roomDetails}`
            : null,
          textRoommate,
          `Guests on your request: ${request.people}`,
          `Check-in: ${formatStayDate(request.checkIn)}`,
          `Check-out: ${formatStayDate(request.checkOut)}`,
          itineraryText || null,
          request.adminNotes
            ? `Message from family:\n${request.adminNotes}`
            : null,
        ]
          .filter(Boolean)
          .join("\n\n")
      : [
          `Requested: ${formatStayDate(request.checkIn)} → ${formatStayDate(request.checkOut)}`,
          `Guests: ${request.people} · Rooms: ${request.rooms}`,
          request.adminNotes ? `Message: ${request.adminNotes}` : null,
        ]
          .filter(Boolean)
          .join("\n\n");

  const text = [
    `Dear ${request.name},`,
    "",
    statusLine,
    "",
    textDetails,
    "",
    "With love,",
    "#Swaneet · Haneet & Swarandeep",
  ].join("\n");

  if (request.status !== "confirmed") {
    const html = `
      <div style="margin:0;padding:0;background:#f4efe6;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe6;padding:28px 12px;">
          <tr><td align="center">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fffdf8;border-radius:20px;overflow:hidden;border:1px solid #e8dcc4;">
              <tr><td style="padding:28px 28px 8px;text-align:center;">
                <p style="margin:0 0 8px;letter-spacing:0.28em;text-transform:uppercase;font-size:11px;color:#b8922a;font-family:Georgia,serif;">#Swaneet</p>
                <h1 style="margin:0;font-weight:400;font-size:28px;color:#1a1208;font-family:Georgia,serif;">Update on your stay</h1>
              </td></tr>
              <tr><td style="padding:8px 28px 28px;font-family:Georgia,serif;color:#2a2118;line-height:1.65;font-size:15px;">
                <p>Dear ${escapeHtml(request.name)},</p>
                <p>${escapeHtml(statusLine)}</p>
                <p style="white-space:pre-wrap;">${escapeHtml(textDetails)}</p>
                <p style="margin-top:24px;">With love,<br/>Haneet &amp; Swarandeep</p>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </div>`;
    return { text, html };
  }

  const hotelBody = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-family:Georgia,serif;">
      ${request.hotelName ? detailRow("Hotel", request.hotelName) : ""}
      ${request.hotelAddress ? detailRow("Address", request.hotelAddress) : ""}
      ${request.roomDetails ? detailRow("Room", request.roomDetails) : ""}
      ${detailRow("Guests", String(request.people))}
      ${
        !isSharedRoom &&
        typeof request.roomsAssigned === "number" &&
        request.roomsAssigned > 0
          ? detailRow("Rooms", String(request.roomsAssigned))
          : ""
      }
      ${detailRow("Check-in", formatStayDate(request.checkIn))}
      ${detailRow("Check-out", formatStayDate(request.checkOut))}
    </table>`;

  const roommatesBody =
    isSharedRoom && roommates.length
      ? `
      <p style="margin:0 0 12px;font-size:14px;color:#5c4f3d;font-family:Georgia,serif;">
        One room is shared — please coordinate with each other.
      </p>
      ${roommates
        .map((mate) => {
          const mapsPhone = mate.phone
            ? `<a href="tel:${escapeHtml(mate.phone)}" style="color:#8a6d24;text-decoration:none;">${escapeHtml(mate.phone)}</a>`
            : "";
          const mail = mate.email
            ? `<a href="mailto:${escapeHtml(mate.email)}" style="color:#8a6d24;text-decoration:none;">${escapeHtml(mate.email)}</a>`
            : "";
          return `
            <div style="padding:12px 14px;margin:0 0 10px;border-radius:12px;background:#f7f1e4;border:1px solid #eadfca;">
              <p style="margin:0 0 4px;font-size:16px;color:#1a1208;font-family:Georgia,serif;">${escapeHtml(mate.name)}</p>
              <p style="margin:0;font-size:13px;color:#5c4f3d;font-family:Georgia,serif;line-height:1.5;">
                ${[mapsPhone && `Phone: ${mapsPhone}`, mail && `Email: ${mail}`].filter(Boolean).join("<br/>") || "Contact details to follow"}
              </p>
            </div>`;
        })
        .join("")}`
      : isSharedRoom
        ? `<p style="margin:0;font-family:Georgia,serif;color:#2a2118;">Sharing with ${(request.roomShareWith || []).map(escapeHtml).join(", ")}</p>`
        : "";

  const itineraryBody = events.length
    ? events
        .map((event, index) => {
          const venueLine = [event.venue, event.venueDetail]
            .map((part) => part?.trim())
            .filter(Boolean)
            .join(" · ");
          const maps = eventMapsUrl(event);
          return `
            <div style="padding:14px 0;${index < events.length - 1 ? "border-bottom:1px solid #eadfca;" : ""}">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#9a7b2f;font-family:Georgia,serif;">
                Event ${index + 1}
              </p>
              <p style="margin:0 0 6px;font-size:18px;color:#1a1208;font-family:Georgia,serif;">
                ${escapeHtml(event.name)}
              </p>
              <p style="margin:0 0 4px;font-size:14px;color:#5c4f3d;font-family:Georgia,serif;">
                ${escapeHtml(`${event.day}${event.day && event.date ? ", " : ""}${event.date} · ${event.time}`)}
              </p>
              ${
                venueLine
                  ? `<p style="margin:0 0 2px;font-size:14px;color:#2a2118;font-family:Georgia,serif;"><strong>Venue:</strong> ${escapeHtml(venueLine)}</p>`
                  : ""
              }
              ${
                event.address?.trim()
                  ? `<p style="margin:0 0 10px;font-size:14px;color:#2a2118;font-family:Georgia,serif;"><strong>Location:</strong> ${escapeHtml(event.address.trim())}</p>`
                  : ""
              }
              ${
                maps
                  ? `<a href="${escapeHtml(maps)}" style="display:inline-block;padding:8px 14px;border-radius:999px;background:#1a1208;color:#f7efd8;text-decoration:none;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-family:Georgia,serif;">Open in Maps</a>`
                  : ""
              }
            </div>`;
        })
        .join("")
    : `<p style="margin:0;font-family:Georgia,serif;color:#5c4f3d;">Upcoming events will be shared soon.</p>`;

  const notesBody = request.adminNotes
    ? `<p style="margin:0;font-family:Georgia,serif;color:#2a2118;white-space:pre-wrap;font-size:15px;line-height:1.6;">${escapeHtml(request.adminNotes)}</p>`
    : "";

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#efe6d4;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe6d4;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#fffdf8;border-radius:24px;overflow:hidden;border:1px solid #e0d2b4;box-shadow:0 12px 40px rgba(40,28,10,0.08);">
        <tr>
          <td style="padding:0;background:linear-gradient(160deg,#1a1208 0%,#3a2c18 55%,#5c4520 100%);text-align:center;">
            <div style="padding:36px 28px 28px;">
              <p style="margin:0 0 10px;letter-spacing:0.36em;text-transform:uppercase;font-size:11px;color:#e2c878;font-family:Georgia,Times,serif;">#Swaneet</p>
              <h1 style="margin:0 0 8px;font-weight:400;font-size:32px;line-height:1.2;color:#fff8ea;font-family:Georgia,Times,serif;">
                ${escapeHtml(title)}
              </h1>
              <p style="margin:0;font-size:14px;color:#d9c69a;font-family:Georgia,Times,serif;">
                Haneet &amp; Swarandeep
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 8px;font-family:Georgia,Times,serif;color:#2a2118;line-height:1.65;font-size:15px;">
            <p style="margin:0 0 8px;font-size:18px;color:#1a1208;">Dear ${escapeHtml(request.name)},</p>
            <p style="margin:0 0 22px;color:#5c4f3d;">${escapeHtml(statusLine)}</p>

            ${sectionCard("Stay details", hotelBody)}
            ${isSharedRoom ? sectionCard("Your roommates", roommatesBody) : ""}
            ${sectionCard("Upcoming itinerary", itineraryBody)}
            ${notesBody ? sectionCard("A note from the family", notesBody) : ""}

            <p style="margin:8px 0 0;color:#5c4f3d;font-size:15px;">
              With love,<br/>
              <span style="color:#1a1208;font-size:17px;">Haneet &amp; Swarandeep</span>
            </p>
            <p style="margin:18px 0 0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#b8922a;">
              #Swaneet · August 2026
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 28px 28px;">
            <div style="height:1px;background:linear-gradient(90deg,transparent,#e0d2b4,transparent);"></div>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { text, html };
}
