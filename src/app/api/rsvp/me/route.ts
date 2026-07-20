import { NextResponse } from "next/server";
import { verifyBearerToken } from "@/lib/firebase/admin";
import { inviteSiteFromPayload } from "@/lib/rsvp-days";
import {
  findAccommodationByGuest,
  findRsvpByGuest,
} from "@/lib/store";
import type { FeatureSite } from "@/lib/types";

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

    const { searchParams } = new URL(request.url);
    const siteParam = searchParams.get("site") || undefined;
    const inviteSite: FeatureSite = inviteSiteFromPayload({
      inviteSite:
        siteParam === "main" || siteParam === "mehfil" || siteParam === "laavan"
          ? siteParam
          : undefined,
      inviteTier:
        siteParam === "mehfil" || siteParam === "laavan" ? siteParam : undefined,
    });

    const [rsvp, accommodation] = await Promise.all([
      findRsvpByGuest(guest.uid, guest.email, inviteSite),
      findAccommodationByGuest(guest.uid, guest.email, inviteSite),
    ]);

    return NextResponse.json({ rsvp, accommodation, inviteSite });
  } catch (error) {
    console.error("GET /api/rsvp/me failed", error);
    return NextResponse.json(
      { error: "Could not load your RSVP" },
      { status: 500 },
    );
  }
}
