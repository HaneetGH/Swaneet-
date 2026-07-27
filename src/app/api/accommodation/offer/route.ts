import { NextResponse } from "next/server";
import { z } from "zod";
import { sendAccommodationEmail } from "@/lib/email";
import { verifyStayOfferToken } from "@/lib/stay-offer";
import {
  formatStayDateLabel,
  stayNights,
} from "@/lib/stay-dates";
import {
  getRoomInventory,
  listAccommodations,
  releaseStayAssignment,
  updateAccommodation,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("t");
    const claims = verifyStayOfferToken(token);
    if (!claims) {
      return NextResponse.json(
        { error: "This offer link is invalid or expired" },
        { status: 403 },
      );
    }

    const stay = (await listAccommodations()).find(
      (item) => item.id === claims.stayId,
    );
    if (!stay) {
      return NextResponse.json({ error: "Stay request not found" }, { status: 404 });
    }

    const requestedIn = stay.requestedCheckIn || stay.checkIn;
    const requestedOut = stay.requestedCheckOut || stay.checkOut;

    return NextResponse.json({
      stay: {
        id: stay.id,
        name: stay.name,
        status: stay.status,
        offerStatus: stay.offerStatus || "none",
        hotelName: stay.hotelName,
        roomDetails: stay.roomDetails,
        people: stay.people,
        roomsAssigned: stay.roomsAssigned,
        requestedCheckIn: requestedIn,
        requestedCheckOut: requestedOut,
        requestedNights: stayNights(requestedIn, requestedOut),
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        offeredNights: stayNights(stay.checkIn, stay.checkOut),
        requestedLabel: `${formatStayDateLabel(requestedIn)} → ${formatStayDateLabel(requestedOut)}`,
        offeredLabel: `${formatStayDateLabel(stay.checkIn)} → ${formatStayDateLabel(stay.checkOut)}`,
      },
      action: claims.action || null,
    });
  } catch (error) {
    console.error("GET /api/accommodation/offer failed", error);
    return NextResponse.json({ error: "Could not load offer" }, { status: 500 });
  }
}

const actionSchema = z.object({
  token: z.string().trim().min(10),
  action: z.enum(["accept", "decline"]),
});

export async function POST(request: Request) {
  try {
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const claims = verifyStayOfferToken(parsed.data.token);
    if (!claims) {
      return NextResponse.json(
        { error: "This offer link is invalid or expired" },
        { status: 403 },
      );
    }

    const stay = (await listAccommodations()).find(
      (item) => item.id === claims.stayId,
    );
    if (!stay) {
      return NextResponse.json({ error: "Stay request not found" }, { status: 404 });
    }

    // Dates in token must still match the offered stay
    if (
      stay.checkIn !== claims.checkIn ||
      stay.checkOut !== claims.checkOut
    ) {
      return NextResponse.json(
        {
          error:
            "This offer was updated by the family. Please use the latest email link.",
        },
        { status: 409 },
      );
    }

    if (stay.offerStatus === "accepted" && parsed.data.action === "accept") {
      return NextResponse.json({
        ok: true,
        already: true,
        message: "You already accepted this stay.",
        stay,
      });
    }

    if (parsed.data.action === "accept") {
      const updated = await updateAccommodation(stay.id, {
        offerStatus: "accepted",
        status: "confirmed",
        checkIn: claims.checkIn,
        checkOut: claims.checkOut,
      });
      if (updated) {
        await sendAccommodationEmail(updated).catch(() => undefined);
      }
      return NextResponse.json({
        ok: true,
        action: "accept",
        message: "Thank you — your stay is confirmed.",
        stay: updated || stay,
        inventory: await getRoomInventory(),
      });
    }

    // Decline — release room hold and restore original requested dates
    const released = await releaseStayAssignment(stay.id);
    const declined = await updateAccommodation(stay.id, {
      offerStatus: "declined",
      status: "pending",
      checkIn: stay.requestedCheckIn || stay.checkIn,
      checkOut: stay.requestedCheckOut || stay.checkOut,
      adminNotes: [stay.adminNotes, "Guest declined shorter-stay offer"]
        .filter(Boolean)
        .join(" · "),
    });

    return NextResponse.json({
      ok: true,
      action: "decline",
      message:
        "Offer declined. We’ve released that room — the family may follow up with other options.",
      stay: declined || released.stay,
      inventory: released.inventory,
    });
  } catch (error) {
    console.error("POST /api/accommodation/offer failed", error);
    const message =
      error instanceof Error ? error.message : "Could not update offer";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
