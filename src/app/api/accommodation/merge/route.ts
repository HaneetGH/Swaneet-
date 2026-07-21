import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { sendAccommodationEmail } from "@/lib/email";
import {
  mergeStaysIntoSharedRoom,
  updateAccommodation,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string().trim().min(1)).min(2).max(10),
  hotelId: z.string().trim().min(1, "Select a hotel"),
  roomDetails: z.string().trim().max(500).optional(),
  adminNotes: z.string().trim().max(500).optional(),
});

/**
 * Merge stay requests into one shared room (any people mix you choose).
 * Does not delete any request. Deducts 1 inventory room.
 * Rejects anyone who already has rooms assigned.
 * Emails every guest in the share (same as Save & email on a single stay).
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

    const emailResults: Array<{
      id: string;
      name: string;
      sent: boolean;
      error?: string;
    }> = [];

    let stays = result.stays;
    for (const stay of result.stays) {
      const mailed = await sendAccommodationEmail(stay);
      if (mailed.ok) {
        const withEmail = await updateAccommodation(stay.id, {
          emailSentAt: now,
        });
        if (withEmail) {
          stays = stays.map((row) => (row.id === stay.id ? withEmail : row));
        }
        emailResults.push({ id: stay.id, name: stay.name, sent: true });
      } else {
        emailResults.push({
          id: stay.id,
          name: stay.name,
          sent: false,
          error: mailed.error,
        });
      }
    }

    const sentCount = emailResults.filter((row) => row.sent).length;
    const failed = emailResults.filter((row) => !row.sent);
    const names = result.stays.map((s) => s.name).join(", ");

    let message = `Shared 1 room for ${names}. All requests kept.`;
    if (sentCount === emailResults.length) {
      message += ` Confirmation emailed to all ${sentCount}.`;
    } else if (sentCount > 0) {
      message += ` Emailed ${sentCount}/${emailResults.length}.`;
      if (failed.length) {
        message += ` Failed: ${failed.map((f) => f.name).join(", ")}.`;
      }
    } else {
      message +=
        " No confirmation emails sent — check each guest has an email, then use Save & email.";
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
