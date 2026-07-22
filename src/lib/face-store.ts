import {
  getFaceImageIndexFromDb,
  getFaceProfileFromDb,
  listFaceImageIndexFromDb,
  upsertFaceImageIndexToDb,
  upsertFaceProfileToDb,
} from "@/lib/db";
import { hasDatabase } from "@/lib/env";
import {
  indexGalleryImageFaces,
  isRekognitionConfigured,
  searchGalleryImagesBySelfie,
} from "@/lib/rekognition";
import { readStore, writeStore } from "@/lib/store";
import type {
  GalleryFaceIndexEntry,
  GalleryImage,
  GuestFaceProfile,
} from "@/lib/types";
import { deleteUploadedImage, saveUploadedImage } from "@/lib/uploads";

export async function getFaceProfile(
  uid: string,
): Promise<GuestFaceProfile | null> {
  if (hasDatabase()) {
    return getFaceProfileFromDb(uid);
  }
  const store = await readStore();
  return (store.faceProfiles || []).find((item) => item.uid === uid) || null;
}

export async function saveFaceProfile(
  profile: GuestFaceProfile,
): Promise<GuestFaceProfile> {
  if (hasDatabase()) {
    await upsertFaceProfileToDb(profile);
    return profile;
  }
  const store = await readStore();
  const list = [...(store.faceProfiles || [])];
  const index = list.findIndex((item) => item.uid === profile.uid);
  if (index >= 0) list[index] = profile;
  else list.unshift(profile);
  store.faceProfiles = list;
  await writeStore(store);
  return profile;
}

export async function getFaceImageIndex(
  imageId: string,
): Promise<GalleryFaceIndexEntry | null> {
  if (hasDatabase()) {
    return getFaceImageIndexFromDb(imageId);
  }
  const store = await readStore();
  return (store.faceImageIndex || []).find((item) => item.imageId === imageId) || null;
}

export async function listFaceImageIndex(): Promise<GalleryFaceIndexEntry[]> {
  if (hasDatabase()) {
    return listFaceImageIndexFromDb();
  }
  const store = await readStore();
  return [...(store.faceImageIndex || [])];
}

export async function saveFaceImageIndex(
  entry: GalleryFaceIndexEntry,
): Promise<void> {
  if (hasDatabase()) {
    await upsertFaceImageIndexToDb(entry);
    return;
  }
  const store = await readStore();
  const list = [...(store.faceImageIndex || [])];
  const index = list.findIndex((item) => item.imageId === entry.imageId);
  if (index >= 0) list[index] = entry;
  else list.push(entry);
  store.faceImageIndex = list;
  await writeStore(store);
}

/** Index one approved gallery image into Rekognition (idempotent). */
export async function indexApprovedGalleryImage(
  image: GalleryImage,
): Promise<GalleryFaceIndexEntry> {
  if (image.kind === "video") {
    const skipped: GalleryFaceIndexEntry = {
      imageId: image.id,
      status: "skipped",
      faceCount: 0,
      error: "Videos are not face-indexed",
      indexedAt: new Date().toISOString(),
    };
    await saveFaceImageIndex(skipped);
    return skipped;
  }

  if (!isRekognitionConfigured()) {
    const failed: GalleryFaceIndexEntry = {
      imageId: image.id,
      status: "failed",
      faceCount: 0,
      error: "AWS Rekognition is not configured",
      indexedAt: new Date().toISOString(),
    };
    await saveFaceImageIndex(failed);
    return failed;
  }

  try {
    const { faceCount } = await indexGalleryImageFaces({
      imageId: image.id,
      src: image.src,
    });
    const entry: GalleryFaceIndexEntry = {
      imageId: image.id,
      status: "indexed",
      faceCount,
      indexedAt: new Date().toISOString(),
    };
    await saveFaceImageIndex(entry);
    return entry;
  } catch (error) {
    const entry: GalleryFaceIndexEntry = {
      imageId: image.id,
      status: "failed",
      faceCount: 0,
      error: error instanceof Error ? error.message : "Index failed",
      indexedAt: new Date().toISOString(),
    };
    await saveFaceImageIndex(entry);
    return entry;
  }
}

/** Enroll selfie + search collection for matching gallery photos. */
export async function enrollGuestSelfieAndMatch(input: {
  uid: string;
  email?: string;
  name?: string;
  file: File;
}): Promise<GuestFaceProfile> {
  if (!isRekognitionConfigured()) {
    throw new Error(
      "Face find needs AWS Rekognition env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION).",
    );
  }

  const existing = await getFaceProfile(input.uid);
  const selfieSrc = await saveUploadedImage(input.file);

  const now = new Date().toISOString();
  let profile: GuestFaceProfile = {
    uid: input.uid,
    email: input.email,
    name: input.name,
    selfieSrc,
    status: "matching",
    matchedImageIds: existing?.matchedImageIds || [],
    matchCount: existing?.matchCount || 0,
    enrolledAt: existing?.enrolledAt || now,
    updatedAt: now,
  };
  await saveFaceProfile(profile);

  try {
    const { imageIds } = await searchGalleryImagesBySelfie({
      selfieSrc,
      threshold: 85,
      maxFaces: 200,
    });

    // Only keep ids that still exist as approved gallery images
    const store = await readStore();
    const approved = new Set(
      store.gallery
        .filter((item) => item.status === "approved" && item.kind === "image")
        .map((item) => item.id),
    );
    const matchedImageIds = imageIds.filter((id) => approved.has(id));

    profile = {
      ...profile,
      status: "ready",
      error: undefined,
      matchedImageIds,
      matchCount: matchedImageIds.length,
      lastMatchedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveFaceProfile(profile);

    if (existing?.selfieSrc && existing.selfieSrc !== selfieSrc) {
      await deleteUploadedImage(existing.selfieSrc).catch(() => undefined);
    }

    return profile;
  } catch (error) {
    profile = {
      ...profile,
      status: "failed",
      error: error instanceof Error ? error.message : "Matching failed",
      updatedAt: new Date().toISOString(),
    };
    await saveFaceProfile(profile);
    throw error;
  }
}

/** Re-run match using the stored selfie (no new upload). */
export async function rematchGuestFace(
  uid: string,
): Promise<GuestFaceProfile> {
  const existing = await getFaceProfile(uid);
  if (!existing?.selfieSrc) {
    throw new Error("Upload a selfie first");
  }
  if (!isRekognitionConfigured()) {
    throw new Error("AWS Rekognition is not configured");
  }

  const { imageIds } = await searchGalleryImagesBySelfie({
    selfieSrc: existing.selfieSrc,
    threshold: 85,
    maxFaces: 200,
  });

  const store = await readStore();
  const approved = new Set(
    store.gallery
      .filter((item) => item.status === "approved" && item.kind === "image")
      .map((item) => item.id),
  );
  const matchedImageIds = imageIds.filter((id) => approved.has(id));

  const profile: GuestFaceProfile = {
    ...existing,
    status: "ready",
    error: undefined,
    matchedImageIds,
    matchCount: matchedImageIds.length,
    lastMatchedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await saveFaceProfile(profile);
  return profile;
}
