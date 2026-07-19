import { head, put } from "@vercel/blob";
import type { ContentStore } from "@/lib/types";

const CONTENT_PATH = "wedding/content.json";

export async function readStoreFromBlob(): Promise<ContentStore | null> {
  try {
    const meta = await head(CONTENT_PATH);
    const response = await fetch(meta.url, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as ContentStore;
  } catch {
    return null;
  }
}

export async function writeStoreToBlob(store: ContentStore): Promise<void> {
  await put(CONTENT_PATH, JSON.stringify(store, null, 2), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}
