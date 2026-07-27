import { NextResponse } from "next/server";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getFaceProfile } from "@/lib/face-store";
import {
  createGalleryAccessToken,
  toProxiedGalleryImage,
} from "@/lib/gallery-access";
import { isRekognitionConfigured } from "@/lib/rekognition";
import { isGuestAuthFailure, requireGuestAuth } from "@/lib/require-guest";
import { inviteSiteFromPayload } from "@/lib/rsvp-days";
import {
  findAccommodationByGuest,
  findRsvpByGuest,
  getFeatureFlags,
  listGuestUploads,
} from "@/lib/store";
import type { FeatureSite } from "@/lib/types";

export const dynamic = "force-dynamic";

function siteFromRequest(request: Request): FeatureSite {
  const { searchParams } = new URL(request.url);
  const siteParam = searchParams.get("site") || undefined;
  return inviteSiteFromPayload({
    inviteSite:
      siteParam === "main" || siteParam === "mehfil" || siteParam === "laavan"
        ? siteParam
        : undefined,
    inviteTier:
      siteParam === "mehfil" || siteParam === "laavan" ? siteParam : undefined,
  });
}

/**
 * Guest account hub: RSVP, stay booking, uploads, and face-find summary.
 * Reading own data is allowed even when public RSVP/upload CTAs are off.
 */
export async function GET(request: Request) {
  try {
    const guest = await requireGuestAuth(request);
    if (isGuestAuthFailure(guest)) return guest;

    const inviteSite = siteFromRequest(request);
    const flags = await getFeatureFlags();
    const accessToken = createGalleryAccessToken(guest.uid, inviteSite);

    const [rsvp, accommodation, uploads] = await Promise.all([
      findRsvpByGuest(guest.uid, guest.email, inviteSite),
      findAccommodationByGuest(guest.uid, guest.email, inviteSite),
      listGuestUploads(guest.uid, guest.email),
    ]);

    const faceOn = isFeatureEnabled(flags, inviteSite, "face_find");
    const faceProfile = faceOn ? await getFaceProfile(guest.uid) : null;

    const uploadCounts = uploads.reduce(
      (acc, image) => {
        acc.total += 1;
        if (image.status === "pending") acc.pending += 1;
        else if (image.status === "approved") acc.approved += 1;
        else if (image.status === "rejected") acc.rejected += 1;
        return acc;
      },
      { total: 0, pending: 0, approved: 0, rejected: 0 },
    );

    return NextResponse.json({
      guest: {
        uid: guest.uid,
        email: guest.email,
        name: guest.name,
      },
      inviteSite,
      features: {
        rsvp: isFeatureEnabled(flags, inviteSite, "rsvp"),
        accommodation: isFeatureEnabled(flags, inviteSite, "accommodation"),
        guestPhotos: isFeatureEnabled(flags, inviteSite, "guest_photos"),
        faceFind: faceOn,
      },
      rsvp,
      accommodation,
      uploads: {
        counts: uploadCounts,
        images: uploads.slice(0, 24).map((image) => {
          const proxied = toProxiedGalleryImage(image, accessToken);
          return {
            id: image.id,
            alt: image.alt,
            status: image.status,
            kind: image.kind,
            createdAt: image.createdAt,
            eventId: image.eventId,
            eventName: image.eventName,
            src: proxied.src,
          };
        }),
      },
      face: faceOn
        ? {
            profile: faceProfile,
            rekognitionReady: isRekognitionConfigured(),
          }
        : null,
    });
  } catch (error) {
    console.error("GET /api/account failed", error);
    return NextResponse.json(
      { error: "Could not load your account" },
      { status: 500 },
    );
  }
}
