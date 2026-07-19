import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission, sessionHasPermission, getAdminSession } from "@/lib/auth";
import { listGallery, readStore, writeStore } from "@/lib/store";
import type { GalleryImage } from "@/lib/types";
import { saveUploadedImage } from "@/lib/uploads";

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED_IMAGES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const registerSchema = z.object({
  eventId: z.string().trim().min(1, "Select an event for these photos"),
  media: z
    .array(
      z.object({
        src: z.string().trim().min(1),
        alt: z.string().optional().default(""),
        aspect: z.enum(["portrait", "landscape", "square"]).default("square"),
        kind: z.enum(["image", "video"]).default("image"),
      }),
    )
    .min(1)
    .max(MAX_FILES),
});

function collectFiles(form: FormData): File[] {
  const fromFiles = form
    .getAll("files")
    .filter((item): item is File => item instanceof File);
  if (fromFiles.length) return fromFiles;
  const single = form.get("file");
  return single instanceof File ? [single] : [];
}

function mediaKind(file: File): GalleryImage["kind"] {
  return file.type.startsWith("video/") ? "video" : "image";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const eventId = searchParams.get("eventId");
  const wantsAll = searchParams.get("all") === "1";
  const session = await getAdminSession();
  const includePending =
    wantsAll && sessionHasPermission(session, "gallery");
  const gallery = await listGallery({ includePending });
  const filtered = eventId
    ? gallery.filter((image) => image.eventId === eventId)
    : gallery;
  return NextResponse.json({ gallery: filtered });
}

/** Register media already uploaded to Blob (preferred for videos / large files). */
async function registerFromJson(request: Request) {
  if (!(await requirePermission("gallery"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = registerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid media payload" },
      { status: 400 },
    );
  }

  const store = await readStore();
  const event = store.events.find((item) => item.id === parsed.data.eventId);
  if (!event) {
    return NextResponse.json(
      { error: "Selected event was not found" },
      { status: 400 },
    );
  }

  const images: GalleryImage[] = parsed.data.media.map((item, index) => ({
    id: randomUUID(),
    eventId: parsed.data.eventId,
    src: item.src,
    aspect: item.aspect,
    kind: item.kind,
    status: "approved" as const,
    source: "admin" as const,
    alt:
      item.alt ||
      `${event.name} ${item.kind === "video" ? "video" : "photo"}${
        parsed.data.media.length > 1 ? ` (${index + 1})` : ""
      }`,
    createdAt: new Date().toISOString(),
  }));

  store.gallery = [...images, ...store.gallery];
  await writeStore(store);

  return NextResponse.json({ images, image: images[0] }, { status: 201 });
}

/** Local / small-image fallback through FormData (not suitable for videos on Vercel). */
async function registerFromFormData(request: Request) {
  if (!(await requirePermission("gallery"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "File too large for direct upload. Connect Vercel Blob and upload again (required for videos).",
      },
      { status: 413 },
    );
  }

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
      { error: `You can upload a maximum of ${MAX_FILES} files at once` },
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
    if (file.type.startsWith("video/")) {
      return NextResponse.json(
        {
          error:
            "Videos must upload via Blob. Connect Vercel Blob in project Storage, then try again.",
        },
        { status: 400 },
      );
    }
    if (!ALLOWED_IMAGES.has(file.type)) {
      return NextResponse.json(
        {
          error: `${file.name}: only JPG, PNG, WEBP, GIF, MP4, WEBM, or MOV are allowed`,
        },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        {
          error: `${file.name}: over 8MB — connect Blob for larger files, or compress the image`,
        },
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
      kind: mediaKind(file),
      status: "approved",
      source: "admin",
      createdAt: new Date().toISOString(),
    });
  }

  store.gallery = [...images, ...store.gallery];
  await writeStore(store);

  return NextResponse.json({ images, image: images[0] }, { status: 201 });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await registerFromJson(request);
    }
    return await registerFromFormData(request);
  } catch (error) {
    console.error("POST /api/gallery failed", error);
    const message =
      error instanceof Error ? error.message : "Could not upload media";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
