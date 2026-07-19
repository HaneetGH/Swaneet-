import { del, put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { hasBlobStorage } from "@/lib/env";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function extensionForFile(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;

  const mime = file.type.toLowerCase();
  if (mime === "image/jpeg") return "jpg";
  if (mime === "video/quicktime") return "mov";
  return mime.split("/")[1] || "bin";
}

export async function saveUploadedImage(file: File): Promise<string> {
  const ext = extensionForFile(file);
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

  if (hasBlobStorage()) {
    const blob = await put(`gallery/${filename}`, file, {
      access: "public",
      addRandomSuffix: false,
      contentType: file.type || undefined,
    });
    return blob.url;
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
  return `/uploads/${filename}`;
}

export async function deleteUploadedImage(src: string): Promise<void> {
  if (src.includes("blob.vercel-storage.com") || src.startsWith("https://")) {
    if (hasBlobStorage()) {
      try {
        await del(src);
      } catch {
        // Blob may already be gone
      }
    }
    return;
  }

  if (src.startsWith("/uploads/")) {
    try {
      await fs.unlink(path.join(process.cwd(), "public", src));
    } catch {
      // Local file may already be gone
    }
  }
}
