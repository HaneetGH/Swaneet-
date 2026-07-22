import { NextResponse } from "next/server";
import { z } from "zod";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isRekognitionConfigured } from "@/lib/rekognition";
import {
  isGuestAuthFailure,
  requireGuestAuth,
} from "@/lib/require-guest";
import {
  enrollGuestSelfieAndMatch,
  getFaceProfile,
  rematchGuestFace,
} from "@/lib/face-store";
import { getFeatureFlags } from "@/lib/store";
import type { FeatureSite } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function siteFromRequest(request: Request): FeatureSite {
  const url = new URL(request.url);
  const site = url.searchParams.get("site");
  if (site === "mehfil" || site === "laavan" || site === "main") return site;
  return "main";
}

async function requireFaceFind(site: FeatureSite) {
  const flags = await getFeatureFlags();
  if (!isFeatureEnabled(flags, site, "face_find")) {
    return NextResponse.json(
      { error: "Find my photos is turned off for this site", code: "FEATURE_OFF" },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const site = siteFromRequest(request);
    const blocked = await requireFaceFind(site);
    if (blocked) return blocked;

    const guest = await requireGuestAuth(request);
    if (isGuestAuthFailure(guest)) return guest;

    const profile = await getFaceProfile(guest.uid);
    return NextResponse.json({
      profile,
      rekognitionReady: isRekognitionConfigured(),
    });
  } catch (error) {
    console.error("GET /api/face/profile failed", error);
    return NextResponse.json(
      { error: "Could not load face profile" },
      { status: 500 },
    );
  }
}

const rematchSchema = z.object({
  action: z.literal("rematch").optional(),
});

export async function POST(request: Request) {
  try {
    const site = siteFromRequest(request);
    const blocked = await requireFaceFind(site);
    if (blocked) return blocked;

    const guest = await requireGuestAuth(request);
    if (isGuestAuthFailure(guest)) return guest;

    if (!isRekognitionConfigured()) {
      return NextResponse.json(
        {
          error:
            "Face matching is not configured yet. Add AWS Rekognition keys on Vercel.",
        },
        { status: 503 },
      );
    }

    const contentType = request.headers.get("content-type") || "";

    // JSON rematch (reuse existing selfie)
    if (contentType.includes("application/json")) {
      const parsed = rematchSchema.safeParse(await request.json().catch(() => ({})));
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }
      const profile = await rematchGuestFace(guest.uid);
      return NextResponse.json({
        profile,
        message:
          profile.matchCount > 0
            ? `Found ${profile.matchCount} photo${profile.matchCount === 1 ? "" : "s"} of you`
            : "No matching photos yet — more may appear as new photos are indexed",
      });
    }

    // Multipart selfie upload
    const form = await request.formData();
    const file = form.get("selfie");
    if (!(file instanceof File) || file.size < 1) {
      return NextResponse.json(
        { error: "Choose a clear selfie photo" },
        { status: 400 },
      );
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Selfie must be an image (JPG or PNG)" },
        { status: 400 },
      );
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Selfie must be under 8MB" },
        { status: 400 },
      );
    }

    const profile = await enrollGuestSelfieAndMatch({
      uid: guest.uid,
      email: guest.email,
      name: guest.name,
      file,
    });

    return NextResponse.json({
      profile,
      message:
        profile.matchCount > 0
          ? `Found ${profile.matchCount} photo${profile.matchCount === 1 ? "" : "s"} of you`
          : "Selfie saved. No matches yet — try again after more photos are indexed",
    });
  } catch (error) {
    console.error("POST /api/face/profile failed", error);
    const message =
      error instanceof Error ? error.message : "Could not process selfie";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
