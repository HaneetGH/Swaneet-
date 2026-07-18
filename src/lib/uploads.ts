import { del, put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { hasBlobStorage } from "@/lib/env";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

export async function saveUploadedImage(file: File): Promise<string> {
  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;

  if (hasBlobStorage()) {
    const blob = await put(`gallery/${filename}`, file, {
      access: "public",
      addRandomSuffix: false,
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
