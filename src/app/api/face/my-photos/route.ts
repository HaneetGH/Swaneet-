import { NextResponse } from "next/server";
import { createGalleryAccessToken, toProxiedGalleryImages } from "@/lib/gallery-access";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  isGuestAuthFailure,
  requireGuestAuth,
} from "@/lib/require-guest";
import { getFaceProfile } from "@/lib/face-store";
import { getFeatureFlags, readStore } from "@/lib/store";
import type { FeatureSite } from "@/lib/types";

export const dynamic = "force-dynamic";

function siteFromRequest(request: Request): FeatureSite {
  const url = new URL(request.url);
  const site = url.searchParams.get("site");
  if (site === "mehfil" || site === "laavan" || site === "main") return site;
  return "main";
}

export async function GET(request: Request) {
  try {
    const site = siteFromRequest(request);
    const flags = await getFeatureFlags();
    if (!isFeatureEnabled(flags, site, "face_find")) {
      return NextResponse.json(
        { error: "Find my photos is turned off", code: "FEATURE_OFF" },
        { status: 403 },
      );
    }

    const guest = await requireGuestAuth(request);
    if (isGuestAuthFailure(guest)) return guest;

    const profile = await getFaceProfile(guest.uid);
    if (!profile) {
      return NextResponse.json({
        photos: [],
        profile: null,
        message: "Upload a selfie to find your photos",
      });
    }

    const store = await readStore();
    const idSet = new Set(profile.matchedImageIds);
    const matched = store.gallery.filter(
      (item) =>
        idSet.has(item.id) &&
        item.status === "approved" &&
        item.kind === "image",
    );

    const access = createGalleryAccessToken(guest.uid, site);
    const photos = toProxiedGalleryImages(matched, access);

    return NextResponse.json({
      photos,
      profile: {
        uid: profile.uid,
        status: profile.status,
        matchCount: profile.matchCount,
        lastMatchedAt: profile.lastMatchedAt,
        enrolledAt: profile.enrolledAt,
      },
    });
  } catch (error) {
    console.error("GET /api/face/my-photos failed", error);
    return NextResponse.json(
      { error: "Could not load your photos" },
      { status: 500 },
    );
  }
}
