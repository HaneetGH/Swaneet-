/** Extract gallery image id from guest activity detail. */
export function galleryImageIdFromDetail(detail?: string): string | null {
  if (!detail) return null;
  const trimmed = detail.trim();
  if (!trimmed) return null;

  // invite:slug|imageId  or  invite:slug
  if (trimmed.startsWith("invite:")) {
    const rest = trimmed.slice("invite:".length);
    const parts = rest.split("|");
    const imageId = parts[1]?.trim();
    return imageId || null;
  }

  // bare image id
  if (trimmed.length >= 6 && !trimmed.includes(" ")) {
    return trimmed;
  }

  return null;
}

export function mergeDownloadedMedia(
  existing: Array<{ imageId: string; at: string }> | undefined,
  imageId: string,
  at: string,
  limit = 80,
): Array<{ imageId: string; at: string }> {
  const without = (existing || []).filter((item) => item.imageId !== imageId);
  return [{ imageId, at }, ...without].slice(0, limit);
}

/** Collect download ids from dedicated list + activity backfill. */
export function collectDownloadedMedia(
  guest: {
    downloadedMedia?: Array<{ imageId: string; at: string }>;
    activity?: Array<{ action: string; at: string; detail?: string }>;
  },
): Array<{ imageId: string; at: string }> {
  const byId = new Map<string, string>();

  for (const item of guest.downloadedMedia || []) {
    if (!item.imageId) continue;
    const prev = byId.get(item.imageId);
    if (!prev || new Date(item.at).getTime() > new Date(prev).getTime()) {
      byId.set(item.imageId, item.at);
    }
  }

  for (const entry of guest.activity || []) {
    if (entry.action !== "gallery_download") continue;
    const imageId = galleryImageIdFromDetail(entry.detail);
    if (!imageId) continue;
    const prev = byId.get(imageId);
    if (!prev || new Date(entry.at).getTime() > new Date(prev).getTime()) {
      byId.set(imageId, entry.at);
    }
  }

  return [...byId.entries()]
    .map(([imageId, at]) => ({ imageId, at }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
