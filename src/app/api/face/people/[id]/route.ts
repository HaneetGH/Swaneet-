import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import {
  getFacePerson,
  listFaceDetections,
} from "@/lib/face-store";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** One person: all photos + face crops for dashboard album view. */
export async function GET(_request: Request, { params }: Params) {
  try {
    if (!(await requirePermission("gallery_review"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const person = await getFacePerson(id);
    if (!person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const [detections, store] = await Promise.all([
      listFaceDetections(),
      readStore(),
    ]);

    const imageById = new Map(store.gallery.map((item) => [item.id, item]));
    const personDetections = detections.filter(
      (item) => item.personId === person.id,
    );

    const photos = person.imageIds
      .map((imageId) => {
        const image = imageById.get(imageId);
        if (!image || image.status !== "approved") return null;
        const faces = personDetections.filter((d) => d.imageId === imageId);
        return {
          id: image.id,
          src: image.src,
          alt: image.alt,
          eventId: image.eventId,
          faces: faces.map((face) => ({
            faceId: face.faceId,
            boundingBox: face.boundingBox,
          })),
        };
      })
      .filter(Boolean);

    const rep = personDetections.find(
      (item) => item.faceId === person.representativeFaceId,
    );
    const repImage = rep ? imageById.get(rep.imageId) : null;

    return NextResponse.json({
      person,
      preview: repImage
        ? {
            imageId: repImage.id,
            src: repImage.src,
            alt: repImage.alt,
            boundingBox: rep?.boundingBox,
          }
        : null,
      photos,
    });
  } catch (error) {
    console.error("GET /api/face/people/[id] failed", error);
    return NextResponse.json(
      { error: "Could not load person album" },
      { status: 500 },
    );
  }
}
