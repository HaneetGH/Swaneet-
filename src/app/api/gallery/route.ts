import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { listGallery, readStore, writeStore } from "@/lib/store";
import type { GalleryImage } from "@/lib/types";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 10;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function collectFiles(form: FormData): File[] {
  const fromFiles = form.getAll("files").filter((item): item is File => item instanceof File);
  if (fromFiles.length) return fromFiles;
  const single = form.get("file");
  return single instanceof File ? [single] : [];
}

async function saveFile(
  file: File,
  alt: string,
  aspect: GalleryImage["aspect"],
): Promise<GalleryImage> {
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return {
    id: randomUUID(),
    alt: alt || file.name.replace(/\.[^.]+$/, "") || "Wedding photo",
    src: `/uploads/${filename}`,
    aspect,
    createdAt: new Date().toISOString(),
  };
}

export async function GET() {
  const gallery = await listGallery();
  return NextResponse.json({ gallery });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const files = collectFiles(form);
  const alt = String(form.get("alt") || "");
  const aspectRaw = String(form.get("aspect") || "square");
  const aspect: GalleryImage["aspect"] =
    aspectRaw === "portrait" || aspectRaw === "landscape" || aspectRaw === "square"
      ? aspectRaw
      : "square";

  if (!files.length) {
    return NextResponse.json({ error: "At least one image is required" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `You can upload a maximum of ${MAX_FILES} images at once` },
      { status: 400 },
    );
  }

  for (const file of files) {
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: `${file.name}: only JPG, PNG, WEBP, or GIF images are allowed` },
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

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const images: GalleryImage[] = [];
  for (const [index, file] of files.entries()) {
    const caption =
      files.length === 1
        ? alt
        : alt
          ? `${alt} (${index + 1})`
          : file.name.replace(/\.[^.]+$/, "");
    images.push(await saveFile(file, caption, aspect));
  }

  const store = await readStore();
  store.gallery = [...images, ...store.gallery];
  await writeStore(store);

  return NextResponse.json(
    { images, image: images[0] },
    { status: 201 },
  );
}
