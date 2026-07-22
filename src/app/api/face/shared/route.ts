import { NextResponse } from "next/server";
import {
  proxiedShareAlbum,
  verifyFaceShareToken,
} from "@/lib/face-share";
import { getFacePerson } from "@/lib/face-store";
import { readStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Public: load a private shared face album from magic link token. */
export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("t");
    const claims = verifyFaceShareToken(token);
    if (!claims) {
      return NextResponse.json(
        { error: "This photo link is invalid or has expired" },
        { status: 403 },
      );
    }

    const store = await readStore();
    let imageIds = claims.imageIds || [];
    let title = claims.name || "Your photos";

    if (claims.personId) {
      const person = await getFacePerson(claims.personId);
      if (person) {
        imageIds = [...new Set([...imageIds, ...person.imageIds])];
        if (person.name.trim()) title = person.name.trim();
      }
    }

    if (imageIds.length === 0) {
      return NextResponse.json(
        { error: "No photos on this link yet" },
        { status: 404 },
      );
    }

    const idSet = new Set(imageIds);
    const matched = store.gallery.filter(
      (item) =>
        idSet.has(item.id) &&
        item.status === "approved" &&
        item.kind === "image",
    );

    return NextResponse.json({
      title,
      expiresAt: new Date(claims.exp).toISOString(),
      photos: proxiedShareAlbum(matched),
      count: matched.length,
    });
  } catch (error) {
    console.error("GET /api/face/shared failed", error);
    return NextResponse.json(
      { error: "Could not load shared photos" },
      { status: 500 },
    );
  }
}
