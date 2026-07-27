import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import {
  joinStayToRoomGroup,
  leaveRoomGroup,
  listRoomOccupancy,
  releaseStayAssignment,
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
 * - join: add a stay to an existing shared room (releases prior solo assignment)
 * - leave: remove from shared room (inventory stays with remaining members)
 * - release: clear assignment entirely (and leave shared room if needed)
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
        message: "Guest added to the room. Previous solo assignment released if they had one.",
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
      message.includes("enough")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
