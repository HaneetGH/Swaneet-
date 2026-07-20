import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/firebase/admin";
import {
  findAccommodationByGuest,
  findRsvpByGuest,
} from "@/lib/store";

export const dynamic = "force-dynamic";

/** Guest loads their own RSVP + stay after signing in with Google. */
export async function GET(request: Request) {
  try {
    const guest = await verifyBearerToken(request);
    if (!guest) {
      return NextResponse.json(
        { error: "Please sign in with Google" },
        { status: 401 },
      );
    }

    const [rsvp, accommodation] = await Promise.all([
      findRsvpByGuest(guest.uid, guest.email),
      findAccommodationByGuest(guest.uid, guest.email),
    ]);

    return NextResponse.json({ rsvp, accommodation });
  } catch (error) {
    console.error("GET /api/rsvp/me failed", error);
    return NextResponse.json(
      { error: "Could not load your RSVP" },
      { status: 500 },
    );
  }
}
