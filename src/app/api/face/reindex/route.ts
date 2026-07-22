import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  indexApprovedGalleryImage,
  listFaceImageIndex,
} from "@/lib/face-store";
import { isRekognitionConfigured } from "@/lib/rekognition";
import { getFeatureFlags, readStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const schema = z.object({
  /** Re-index all approved images, or only missing ones */
  mode: z.enum(["missing", "all"]).optional().default("missing"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(40),
});

/** Admin: index approved gallery photos into Rekognition. */
export async function POST(request: Request) {
  try {
    if (!(await requirePermission("gallery_review"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const flags = await getFeatureFlags();
    const anySiteOn =
      isFeatureEnabled(flags, "main", "face_find") ||
      isFeatureEnabled(flags, "mehfil", "face_find") ||
      isFeatureEnabled(flags, "laavan", "face_find");
    if (!anySiteOn) {
      return NextResponse.json(
        {
          error:
            "Turn on “Find my photos (face)” in Feature flags before indexing",
          code: "FEATURE_OFF",
        },
        { status: 403 },
      );
    }

    if (!isRekognitionConfigured()) {
      return NextResponse.json(
        {
          error:
            "Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION on Vercel",
        },
        { status: 503 },
      );
    }

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const store = await readStore();
    const existing = await listFaceImageIndex();
    const indexedIds = new Set(
      existing.filter((item) => item.status === "indexed").map((item) => item.imageId),
    );

    const candidates = store.gallery.filter((item) => {
      if (item.status !== "approved" || item.kind !== "image") return false;
      if (parsed.data.mode === "all") return true;
      return !indexedIds.has(item.id);
    });

    const batch = candidates.slice(0, parsed.data.limit);
    const results = [];
    for (const image of batch) {
      results.push(await indexApprovedGalleryImage(image));
    }

    return NextResponse.json({
      ok: true,
      processed: results.length,
      remaining: Math.max(0, candidates.length - batch.length),
      results,
      rekognitionReady: true,
    });
  } catch (error) {
    console.error("POST /api/face/reindex failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not index faces",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    if (!(await requirePermission("gallery_review"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const index = await listFaceImageIndex();
    const indexed = index.filter((item) => item.status === "indexed").length;
    const failed = index.filter((item) => item.status === "failed").length;
    return NextResponse.json({
      total: index.length,
      indexed,
      failed,
      rekognitionReady: isRekognitionConfigured(),
      entries: index.slice(0, 50),
    });
  } catch (error) {
    console.error("GET /api/face/reindex failed", error);
    return NextResponse.json({ error: "Could not load index status" }, { status: 500 });
  }
}
