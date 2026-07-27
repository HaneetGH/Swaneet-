import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import {
  sendAccommodationEmail,
  sendStayOfferEmail,
} from "@/lib/email";
import { buildSharedRoomRoommateContacts } from "@/lib/shared-room-email";
import {
  listAccommodations,
  listRsvps,
  updateAccommodation,
} from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Resend the current stay email without changing assignment:
 * - pending shorter-stay offer → offer Accept/Decline email
 * - otherwise → hotel/room confirmation email
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    if (!(await requirePermission("stay"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const stay = (await listAccommodations()).find((item) => item.id === id);
    if (!stay) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const to = stay.email || stay.authEmail;
    if (!to?.trim()) {
      return NextResponse.json(
        { error: "Add a guest email before resending." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    if (stay.offerStatus === "pending") {
      const result = await sendStayOfferEmail(stay);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || "Could not send offer email", email: { sent: false, kind: "offer" } },
          { status: 502 },
        );
      }
      const updated = await updateAccommodation(id, { emailSentAt: now });
      return NextResponse.json({
        ok: true,
        accommodation: updated || stay,
        email: { sent: true, kind: "offer" as const },
        message: "Shorter-stay offer emailed again.",
      });
    }

    let roommates = undefined;
    if (stay.roomGroupId) {
      const [allStays, rsvps] = await Promise.all([
        listAccommodations(),
        listRsvps(),
      ]);
      const group = allStays.filter(
        (item) => item.roomGroupId === stay.roomGroupId,
      );
      roommates = buildSharedRoomRoommateContacts(group, rsvps, stay.id);
    }

    const result = await sendAccommodationEmail(stay, { roommates });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error || "Could not send email",
          email: { sent: false, kind: "confirm" },
        },
        { status: 502 },
      );
    }

    const updated = await updateAccommodation(id, { emailSentAt: now });
    return NextResponse.json({
      ok: true,
      accommodation: updated || stay,
      email: { sent: true, kind: "confirm" as const },
      message:
        stay.status === "confirmed"
          ? "Room details emailed again."
          : "Stay update emailed again.",
    });
  } catch (error) {
    console.error("POST /api/accommodation/[id]/resend failed", error);
    return NextResponse.json(
      { error: "Could not resend email" },
      { status: 500 },
    );
  }
}
