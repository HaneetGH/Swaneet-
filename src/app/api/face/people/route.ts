import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth";
import {
  getFacePerson,
  listFaceDetections,
  listFacePeople,
  mergeFacePeople,
  renameFacePerson,
} from "@/lib/face-store";
import { isRekognitionConfigured } from "@/lib/rekognition";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** List clustered people for the dashboard Faces tab. */
export async function GET() {
  try {
    if (!(await requireAnyPermission(["gallery_review", "gallery_upload"]))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [people, detections, store] = await Promise.all([
      listFacePeople(),
      listFaceDetections(),
      readStore(),
    ]);

    const imageById = new Map(store.gallery.map((item) => [item.id, item]));
    const detectionByFaceId = new Map(
      detections.map((item) => [item.faceId, item]),
    );

    const rows = people
      .map((person) => {
        const rep = detectionByFaceId.get(person.representativeFaceId);
        const image = rep ? imageById.get(rep.imageId) : null;
        return {
          id: person.id,
          name: person.name,
          photoCount: person.imageIds.length,
          faceCount: person.faceIds.length,
          updatedAt: person.updatedAt,
          preview: image
            ? {
                imageId: image.id,
                src: image.src,
                alt: image.alt,
                boundingBox: rep?.boundingBox,
              }
            : null,
        };
      })
      .sort((a, b) => {
        const named = Number(Boolean(b.name)) - Number(Boolean(a.name));
        if (named !== 0) return named;
        return b.photoCount - a.photoCount;
      });

    return NextResponse.json({
      people: rows,
      total: rows.length,
      rekognitionReady: isRekognitionConfigured(),
    });
  } catch (error) {
    console.error("GET /api/face/people failed", error);
    return NextResponse.json(
      { error: "Could not load faces" },
      { status: 500 },
    );
  }
}

const renameSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().max(80),
});

const mergeSchema = z.object({
  sourceId: z.string().trim().min(1),
  targetId: z.string().trim().min(1),
});

/** Rename a clustered person. Same name as another person merges them. */
export async function PATCH(request: Request) {
  try {
    if (!(await requireAnyPermission(["gallery_review", "gallery_upload"]))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = renameSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid name" },
        { status: 400 },
      );
    }

    const { person, mergedFromIds } = await renameFacePerson(
      parsed.data.id,
      parsed.data.name,
    );
    return NextResponse.json({
      person,
      merged: mergedFromIds.length > 0,
      mergedFromIds,
    });
  } catch (error) {
    console.error("PATCH /api/face/people failed", error);
    const message =
      error instanceof Error ? error.message : "Could not rename person";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Drag-and-drop merge: source person is absorbed into target. */
export async function POST(request: Request) {
  try {
    if (!(await requireAnyPermission(["gallery_review", "gallery_upload"]))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = mergeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid merge" },
        { status: 400 },
      );
    }

    if (parsed.data.sourceId === parsed.data.targetId) {
      return NextResponse.json(
        { error: "Drop onto a different person to merge" },
        { status: 400 },
      );
    }

    const source = await getFacePerson(parsed.data.sourceId);
    const target = await getFacePerson(parsed.data.targetId);
    if (!source || !target) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const person = await mergeFacePeople(
      parsed.data.sourceId,
      parsed.data.targetId,
    );
    return NextResponse.json({
      person,
      merged: true,
      mergedFromIds: [parsed.data.sourceId],
    });
  } catch (error) {
    console.error("POST /api/face/people failed", error);
    const message =
      error instanceof Error ? error.message : "Could not merge people";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
