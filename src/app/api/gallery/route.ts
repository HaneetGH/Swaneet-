import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listGallery, readStore, writeStore } from "@/lib/store";
import type { GalleryImage } from "@/lib/types";
import { saveUploadedImage } from "@/lib/uploads";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function collectFiles(form: FormData): File[] {
  const fromFiles = form
    .getAll("files")
    .filter((item): item is File => item instanceof File);
  if (fromFiles.length) return fromFiles;
  const single = form.get("file");
  return single instanceof File ? [single] : [];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const gallery = await listGallery();
  const filtered = eventId
    ? gallery.filter((image) => image.eventId === eventId)
    : gallery;
  return NextResponse.json({ gallery: filtered });
}

export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const files = collectFiles(form);
    const eventId = String(form.get("eventId") || "").trim();
    const alt = String(form.get("alt") || "");
    const aspectRaw = String(form.get("aspect") || "square");
    const aspect: GalleryImage["aspect"] =
      aspectRaw === "portrait" ||
      aspectRaw === "landscape" ||
      aspectRaw === "square"
        ? aspectRaw
        : "square";

    if (!eventId) {
      return NextResponse.json(
        { error: "Select an event for these photos" },
        { status: 400 },
      );
    }

    if (!files.length) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 },
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `You can upload a maximum of ${MAX_FILES} images at once` },
        { status: 400 },
      );
    }

    const store = await readStore();
    const event = store.events.find((item) => item.id === eventId);
    if (!event) {
      return NextResponse.json(
        { error: "Selected event was not found" },
        { status: 400 },
      );
    }

    for (const file of files) {
      if (!ALLOWED.has(file.type)) {
        return NextResponse.json(
          {
            error: `${file.name}: only JPG, PNG, WEBP, or GIF images are allowed`,
          },
          { status: 400 },
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `${file.name}: image must be under 8MB` },
          { status: 400 },
        );
      }
    }

    const images: GalleryImage[] = [];
    for (const [index, file] of files.entries()) {
      const caption =
        files.length === 1
          ? alt
          : alt
            ? `${alt} (${index + 1})`
            : file.name.replace(/\.[^.]+$/, "");

      const src = await saveUploadedImage(file);
      images.push({
        id: randomUUID(),
        eventId,
        alt: caption || `${event.name} photo`,
        src,
        aspect,
        createdAt: new Date().toISOString(),
      });
    }

    store.gallery = [...images, ...store.gallery];
    await writeStore(store);

    return NextResponse.json({ images, image: images[0] }, { status: 201 });
  } catch (error) {
    console.error("POST /api/gallery failed", error);
    const message =
      error instanceof Error ? error.message : "Could not upload images";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
