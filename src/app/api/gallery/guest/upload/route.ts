import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { hasBlobStorage } from "@/lib/env";
import { verifyBearerToken } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(request: Request) {
  try {
    const guest = await verifyBearerToken(request);
    if (!guest) {
      return NextResponse.json(
        { error: "Please sign in with Google to share photos" },
        { status: 401 },
      );
    }

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
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED,
        maximumSizeInBytes: 12 * 1024 * 1024,
        validUntil: Date.now() + 30 * 60 * 1000,
        addRandomSuffix: true,
      }),
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/gallery/guest/upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 400 });
  }
}
