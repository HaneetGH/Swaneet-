import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { hasBlobStorage } from "@/lib/env";
import {
  featureSiteFromInviteTier,
  isFeatureEnabled,
} from "@/lib/feature-flags";
import { isGuestAuthFailure, requireGuestAuth } from "@/lib/require-guest";
import { getFeatureFlags } from "@/lib/store";
import type { FeatureSite } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function siteFromPayload(clientPayload: string | null): FeatureSite {
  if (!clientPayload) return "main";
  try {
    const parsed = JSON.parse(clientPayload) as {
      inviteTier?: string;
      site?: string;
    };
    if (
      parsed.site === "main" ||
      parsed.site === "mehfil" ||
      parsed.site === "laavan"
    ) {
      return parsed.site;
    }
    if (parsed.inviteTier === "mehfil" || parsed.inviteTier === "laavan") {
      return featureSiteFromInviteTier(parsed.inviteTier);
    }
  } catch {
    // ignore
  }
  return "main";
}

export async function POST(request: Request) {
  try {
    const guest = await requireGuestAuth(request);
    if (isGuestAuthFailure(guest)) return guest;

    if (!hasBlobStorage()) {
      return NextResponse.json(
        {
          error:
            "Photo sharing is not available yet. Blob storage is not connected.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as HandleUploadBody;

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const site = siteFromPayload(clientPayload);
        const flags = await getFeatureFlags();
        if (!isFeatureEnabled(flags, site, "guest_photos")) {
          throw new Error("Guest photo uploads are turned off for this invite");
        }
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: 12 * 1024 * 1024,
          validUntil: Date.now() + 30 * 60 * 1000,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/gallery/guest/upload failed", error);
    const message =
      error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
