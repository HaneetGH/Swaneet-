import { NextResponse } from "next/server";
import {
  featureSiteFromInviteTier,
  isFeatureEnabled,
} from "@/lib/feature-flags";
import { isGuestAuthFailure, requireGuestAuth } from "@/lib/require-guest";
import { inviteSiteFromPayload } from "@/lib/rsvp-days";
import {
  findAccommodationByGuest,
  findRsvpByGuest,
  getFeatureFlags,
} from "@/lib/store";
import type { FeatureSite } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Guest loads their own RSVP + stay after signing in with Google. */
export async function GET(request: Request) {
  try {
    const guest = await requireGuestAuth(request);
    if (isGuestAuthFailure(guest)) return guest;

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

    const flags = await getFeatureFlags();
    const site =
      inviteSite !== "main"
        ? inviteSite
        : featureSiteFromInviteTier(
            siteParam === "mehfil" || siteParam === "laavan"
              ? siteParam
              : undefined,
          );
    if (!isFeatureEnabled(flags, site, "rsvp")) {
      return NextResponse.json(
        { error: "RSVP is turned off for this invite right now" },
        { status: 403 },
      );
    }

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
