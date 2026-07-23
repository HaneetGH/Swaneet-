import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { hasBlobStorage } from "@/lib/env";
import { verifyBearerToken } from "@/lib/firebase/admin";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getFeatureFlags } from "@/lib/store";
import type { FeatureSite } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

function siteFromPayload(clientPayload: string | null): FeatureSite {
  if (!clientPayload) return "main";
  try {
    const parsed = JSON.parse(clientPayload) as { site?: string };
    if (
      parsed.site === "main" ||
      parsed.site === "mehfil" ||
      parsed.site === "laavan"
    ) {
      return parsed.site;
    }
  } catch {
    // ignore
  }
  return "main";
}

export async function POST(request: Request) {
  try {
    if (!hasBlobStorage()) {
      return NextResponse.json(
        {
          error:
            "Blob storage is not connected. In Vercel → Storage, create Blob and redeploy.",
        },
        { status: 503 },
      );
    }

    // Guests (Bearer) or team with Faces permission (dashboard cookie)
    const guest = await verifyBearerToken(request);
    const isTeam = await requirePermission("faces");
    if (!guest && !isTeam) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as HandleUploadBody;

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        if (guest && !isTeam) {
          const site = siteFromPayload(clientPayload);
          const flags = await getFeatureFlags();
          if (!isFeatureEnabled(flags, site, "face_find")) {
            throw new Error("Find my photos is turned off for this site");
          }
        }
        return {
          allowedContentTypes: ALLOWED,
          // Phone cameras are often 5–12MB — must bypass the ~4.5MB serverless body limit
          maximumSizeInBytes: 12 * 1024 * 1024,
          validUntil: Date.now() + 30 * 60 * 1000,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/face/selfie/upload failed", error);
    const message =
      error instanceof Error ? error.message : "Could not prepare selfie upload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
