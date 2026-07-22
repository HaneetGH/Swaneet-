import { after } from "next/server";
import type { GalleryImage } from "@/lib/types";

/**
 * Start face indexing after the HTTP response (Vercel-safe).
 * Admin upload media → immediate index.
 * Guest photos → call this only after approval.
 */
export function scheduleFaceIndex(images: GalleryImage | GalleryImage[]) {
  const list = (Array.isArray(images) ? images : [images]).filter(
    (image) => image.status === "approved" && image.kind === "image",
  );
  if (!list.length) return;

  after(async () => {
    const { maybeIndexGalleryImage } = await import("@/lib/face-store");
    for (const image of list) {
      try {
        await maybeIndexGalleryImage(image);
      } catch (error) {
        console.error("scheduleFaceIndex failed", image.id, error);
      }
    }
  });
}
