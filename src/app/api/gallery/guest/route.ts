import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBearerToken } from "@/lib/firebase/admin";
import { readStore, writeStore } from "@/lib/store";
import type { GalleryImage } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_FILES = 5;

const schema = z.object({
  media: z
    .array(
      z.object({
        src: z.string().trim().url(),
        alt: z.string().optional().default(""),
        aspect: z.enum(["portrait", "landscape", "square"]).default("square"),
      }),
    )
    .min(1)
    .max(MAX_FILES),
});

export async function POST(request: Request) {
  try {
    const guest = await verifyBearerToken(request);
    if (!guest) {
      return NextResponse.json(
        { error: "Please sign in with Google to share photos" },
        { status: 401 },
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid photos" },
        { status: 400 },
      );
    }

    const store = await readStore();
    const images: GalleryImage[] = parsed.data.media.map((item, index) => ({
      id: randomUUID(),
      eventId: "",
      src: item.src,
      aspect: item.aspect,
      kind: "image" as const,
      status: "pending" as const,
      source: "guest" as const,
      uploadedByUid: guest.uid,
      uploadedByEmail: guest.email,
      uploadedByName: guest.name,
      alt:
        item.alt ||
        (guest.name
          ? `From ${guest.name}${parsed.data.media.length > 1 ? ` (${index + 1})` : ""}`
          : `Guest photo${parsed.data.media.length > 1 ? ` (${index + 1})` : ""}`),
      createdAt: new Date().toISOString(),
    }));

    store.gallery = [...images, ...store.gallery];
    await writeStore(store);

    return NextResponse.json({ images, pending: true }, { status: 201 });
  } catch (error) {
    console.error("POST /api/gallery/guest failed", error);
    return NextResponse.json(
      { error: "Could not share photos" },
      { status: 500 },
    );
  }
}
