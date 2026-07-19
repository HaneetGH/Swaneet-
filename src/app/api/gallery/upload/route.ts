import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { hasBlobStorage } from "@/lib/env";

export const dynamic = "force-dynamic";

const ALLOWED = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasBlobStorage()) {
      return NextResponse.json(
        {
          error:
            "Blob storage is not connected. In Vercel → Storage, create Blob and redeploy.",
        },
        { status: 503 },
      );
    }

    const body = (await request.json()) as HandleUploadBody;

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED,
        maximumSizeInBytes: 100 * 1024 * 1024,
        // Long enough for slow video uploads
        validUntil: Date.now() + 60 * 60 * 1000,
        addRandomSuffix: true,
      }),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/gallery/upload failed", error);
    const message =
      error instanceof Error ? error.message : "Could not prepare upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
