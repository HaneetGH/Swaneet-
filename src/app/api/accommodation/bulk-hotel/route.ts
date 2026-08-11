import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { reassignStaysToHotel } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(40),
  hotelId: z.string().trim().min(1, "Select a hotel"),
  useBlockedRooms: z.boolean().optional().default(false),
  clearRoomDetails: z.boolean().optional().default(true),
});

/**
 * Move selected guests (and their shared-room group mates) to another hotel
 * in one step — keeps room counts / shares, changes hotel only.
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
            "Select guests and a destination hotel",
        },
        { status: 400 },
      );
    }

    const result = await reassignStaysToHotel(parsed.data);
    return NextResponse.json({
      ok: true,
      stays: result.stays,
      inventory: result.inventory,
      movedGuestCount: result.movedGuestCount,
      roomsMoved: result.roomsMoved,
      message: `Moved ${result.movedGuestCount} guest${
        result.movedGuestCount === 1 ? "" : "s"
      } (${result.roomsMoved} room${
        result.roomsMoved === 1 ? "" : "s"
      }) to the new hotel.`,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not move guests";
    const status =
      /not enough|not found|select|confirm|assigned/i.test(message) ? 400 : 500;
    console.error("POST /api/accommodation/bulk-hotel failed", error);
    return NextResponse.json({ error: message }, { status });
  }
}
