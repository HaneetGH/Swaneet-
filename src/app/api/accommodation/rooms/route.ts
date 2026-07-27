import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { sendAccommodationEmail } from "@/lib/email";
import { buildSharedRoomRoommateContacts } from "@/lib/shared-room-email";
import {
  joinStayToRoomGroup,
  leaveRoomGroup,
  listAccommodations,
  listRoomOccupancy,
  listRsvps,
  releaseStayAssignment,
  swapStayRooms,
  updateAccommodation,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("join"),
    roomGroupId: z.string().trim().min(1).optional(),
    primaryStayId: z.string().trim().min(1).optional(),
    stayId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("leave"),
    stayId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("release"),
    stayId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal("swap"),
    stayIdA: z.string().trim().min(1),
    stayIdB: z.string().trim().min(1),
  }),
]);

/** Occupancy board data */
export async function GET() {
  try {
    if (!(await requirePermission("stay"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const occupancy = await listRoomOccupancy();
    return NextResponse.json({ occupancy });
  } catch (error) {
    console.error("GET /api/accommodation/rooms failed", error);
    return NextResponse.json(
      { error: "Could not load room occupancy" },
      { status: 500 },
    );
  }
}

/**
 * Room assignment actions:
 * - join: add / move a stay into a room (leaves prior shared room if needed)
 * - leave: remove from shared room (inventory stays with remaining members)
 * - release: clear assignment entirely (and leave shared room if needed)
 * - swap: exchange room assignments between two guests (+ email both)
 */
export async function POST(request: Request) {
  try {
    if (!(await requirePermission("stay"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid room action" },
        { status: 400 },
      );
    }

    if (parsed.data.action === "join") {
      if (!parsed.data.roomGroupId && !parsed.data.primaryStayId) {
        return NextResponse.json(
          { error: "Provide roomGroupId or primaryStayId" },
          { status: 400 },
        );
      }
      const result = await joinStayToRoomGroup({
        roomGroupId: parsed.data.roomGroupId,
        primaryStayId: parsed.data.primaryStayId,
        stayId: parsed.data.stayId,
      });
      return NextResponse.json({
        ok: true,
        action: "join",
        stays: result.stays,
        inventory: result.inventory,
        message:
          "Guest added to the room. Previous assignment released if they had one.",
      });
    }

    if (parsed.data.action === "leave") {
      const result = await leaveRoomGroup(parsed.data.stayId);
      return NextResponse.json({
        ok: true,
        action: "leave",
        stays: result.stays,
        inventory: result.inventory,
        message: "Guest removed from the shared room.",
      });
    }

    if (parsed.data.action === "swap") {
      const result = await swapStayRooms(
        parsed.data.stayIdA,
        parsed.data.stayIdB,
      );

      const [allStays, rsvps] = await Promise.all([
        listAccommodations(),
        listRsvps(),
      ]);
      const now = new Date().toISOString();
      const swapped = [parsed.data.stayIdA, parsed.data.stayIdB]
        .map((id) => allStays.find((item) => item.id === id))
        .filter(Boolean);

      const emailResults: Array<{
        stayId: string;
        name: string;
        sent: boolean;
        error?: string;
      }> = [];

      for (const stay of swapped) {
        if (!stay) continue;
        let roommates = undefined;
        if (stay.roomGroupId) {
          const group = allStays.filter(
            (item) => item.roomGroupId === stay.roomGroupId,
          );
          roommates = buildSharedRoomRoommateContacts(group, rsvps, stay.id);
        }
        const mailed = await sendAccommodationEmail(stay, { roommates });
        if (mailed.ok) {
          await updateAccommodation(stay.id, { emailSentAt: now }).catch(
            () => undefined,
          );
          emailResults.push({
            stayId: stay.id,
            name: stay.name,
            sent: true,
          });
        } else {
          emailResults.push({
            stayId: stay.id,
            name: stay.name,
            sent: false,
            error: mailed.error,
          });
        }
      }

      const sentCount = emailResults.filter((row) => row.sent).length;
      const failed = emailResults.filter((row) => !row.sent);
      const message =
        sentCount === emailResults.length && sentCount > 0
          ? "Guests swapped rooms — updated details emailed to both."
          : sentCount > 0
            ? `Guests swapped rooms — emailed ${sentCount}/${emailResults.length}. ${failed.map((row) => `${row.name}: ${row.error || "failed"}`).join(" · ")}`
            : failed.length
              ? `Guests swapped rooms, but emails failed: ${failed.map((row) => `${row.name}: ${row.error || "failed"}`).join(" · ")}`
              : "Guests swapped rooms.";

      return NextResponse.json({
        ok: true,
        action: "swap",
        stays: result.stays,
        inventory: result.inventory,
        email: { results: emailResults, sent: sentCount },
        message,
      });
    }

    const result = await releaseStayAssignment(parsed.data.stayId);
    return NextResponse.json({
      ok: true,
      action: "release",
      stay: result.stay,
      inventory: result.inventory,
      message: "Room assignment released — inventory updated.",
    });
  } catch (error) {
    console.error("POST /api/accommodation/rooms failed", error);
    const message =
      error instanceof Error ? error.message : "Could not update room";
    const status =
      message.includes("already") ||
      message.includes("not found") ||
      message.includes("declined") ||
      message.includes("Select") ||
      message.includes("enough") ||
      message.includes("Pick two") ||
      message.includes("Both guests")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
