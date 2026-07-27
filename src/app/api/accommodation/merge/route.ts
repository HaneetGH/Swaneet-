import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { sendAccommodationEmail } from "@/lib/email";
import { collectSharedRoomEmailRecipients, buildSharedRoomRoommateContacts } from "@/lib/shared-room-email";
import {
  listRsvps,
  mergeStaysIntoSharedRoom,
  updateAccommodation,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string().trim().min(1)).min(2).max(10),
  hotelId: z.string().trim().min(1, "Select a hotel"),
  roomDetails: z.string().trim().max(500).optional(),
  adminNotes: z.string().trim().max(500).optional(),
  useBlockedRooms: z.boolean().optional().default(false),
});

/**
 * Merge stay requests into one shared room (any people mix you choose).
 * Does not delete any request. Deducts 1 inventory room.
 * Rejects anyone who already has rooms assigned.
 * Emails every stay in the share (n requests → n emails).
 * Each guest is told they have a room, who they share with, and roommate phone/email.
 */
export async function POST(request: Request) {
  try {
    if (!(await requirePermission("stay"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message ||
            "Select at least 2 stay requests and a hotel",
        },
        { status: 400 },
      );
    }

    const result = await mergeStaysIntoSharedRoom(parsed.data);
    const now = new Date().toISOString();
    const rsvps = await listRsvps();
    const recipients = collectSharedRoomEmailRecipients(result.stays, rsvps);
    const coveredStayIds = new Set(recipients.map((r) => r.stay.id));
    const totalGuests = result.stays.length;

    const emailResults: Array<{
      email: string;
      name: string;
      stayId: string;
      source: "stay" | "rsvp";
      sent: boolean;
      error?: string;
    }> = [];

    let stays = result.stays;

    for (const stay of result.stays) {
      if (coveredStayIds.has(stay.id)) continue;
      emailResults.push({
        email: "",
        name: stay.name,
        stayId: stay.id,
        source: "stay",
        sent: false,
        error: "No email on stay or linked RSVP",
      });
    }

    for (const recipient of recipients) {
      const roommates = buildSharedRoomRoommateContacts(
        result.stays,
        rsvps,
        recipient.stay.id,
      );
      const mailed = await sendAccommodationEmail(
        {
          ...recipient.stay,
          email: recipient.email,
        },
        { roommates },
      );
      if (mailed.ok) {
        emailResults.push({
          email: recipient.email,
          name: recipient.name,
          stayId: recipient.stay.id,
          source: recipient.source,
          sent: true,
        });
      } else {
        emailResults.push({
          email: recipient.email,
          name: recipient.name,
          stayId: recipient.stay.id,
          source: recipient.source,
          sent: false,
          error: mailed.error,
        });
      }
    }

    const sentStayIds = new Set(
      emailResults.filter((row) => row.sent).map((row) => row.stayId),
    );
    for (const stayId of sentStayIds) {
      const withEmail = await updateAccommodation(stayId, {
        emailSentAt: now,
      });
      if (withEmail) {
        stays = stays.map((row) => (row.id === stayId ? withEmail : row));
      }
    }

    const sentCount = emailResults.filter((row) => row.sent).length;
    const failed = emailResults.filter((row) => !row.sent);
    const names = result.stays.map((s) => s.name).join(", ");

    let message = `Shared 1 room for ${names}. All ${totalGuests} requests kept.`;
    if (sentCount === totalGuests && failed.length === 0) {
      message += ` Sent ${sentCount} email${sentCount === 1 ? "" : "s"} — each includes roommate phone & email.`;
    } else if (sentCount > 0) {
      message += ` Sent ${sentCount}/${totalGuests} emails.`;
      if (failed.length) {
        message += ` Missing/failed: ${failed.map((f) => f.name || f.email).join(", ")}.`;
      }
    } else {
      message +=
        " No emails sent — each guest needs an email on their stay or RSVP.";
      if (failed[0]?.error) {
        message += ` (${failed[0].error})`;
      }
    }

    return NextResponse.json({
      ok: true,
      roomGroupId: result.roomGroupId,
      stays,
      inventory: result.inventory,
      email: {
        sent: sentCount,
        total: emailResults.length,
        results: emailResults,
      },
      message,
    });
  } catch (error) {
    console.error("POST /api/accommodation/merge failed", error);
    const message =
      error instanceof Error ? error.message : "Could not merge stays";
    const status =
      message.includes("already has") ||
      message.includes("No rooms") ||
      message.includes("Select") ||
      message.includes("declined") ||
      message.includes("already in")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
