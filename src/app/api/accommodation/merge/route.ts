import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { mergeStaysIntoSharedRoom } from "@/lib/store";

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
    return NextResponse.json({
      ok: true,
      roomGroupId: result.roomGroupId,
      stays: result.stays,
      inventory: result.inventory,
      message: `Shared 1 room for ${result.stays.map((s) => s.name).join(", ")}. All requests kept.`,
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
