import { randomUUID } from "crypto";
import {
  getFaceDetectionFromDb,
  getFaceImageIndexFromDb,
  getFacePersonFromDb,
  getFaceProfileFromDb,
  listFaceDetectionsFromDb,
  listFaceImageIndexFromDb,
  listFacePeopleFromDb,
  upsertFaceDetectionToDb,
  upsertFaceImageIndexToDb,
  upsertFacePersonToDb,
  upsertFaceProfileToDb,
} from "@/lib/db";
import { hasDatabase } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  indexGalleryImageFaces,
  isRekognitionConfigured,
  awsErrorMessage,
  searchGalleryImagesBySelfie,
  searchSimilarFaces,
} from "@/lib/rekognition";
import { getFeatureFlags, readStore, writeStore } from "@/lib/store";
import type {
  FaceDetection,
  FacePerson,
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
  return (
    (store.faceImageIndex || []).find((item) => item.imageId === imageId) ||
    null
  );
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

export async function listFacePeople(): Promise<FacePerson[]> {
  if (hasDatabase()) {
    return listFacePeopleFromDb();
  }
  const store = await readStore();
  return [...(store.facePeople || [])];
}

export async function getFacePerson(id: string): Promise<FacePerson | null> {
  if (hasDatabase()) {
    return getFacePersonFromDb(id);
  }
  const store = await readStore();
  return (store.facePeople || []).find((item) => item.id === id) || null;
}

export async function saveFacePerson(person: FacePerson): Promise<FacePerson> {
  if (hasDatabase()) {
    await upsertFacePersonToDb(person);
    return person;
  }
  const store = await readStore();
  const list = [...(store.facePeople || [])];
  const index = list.findIndex((item) => item.id === person.id);
  if (index >= 0) list[index] = person;
  else list.unshift(person);
  store.facePeople = list;
  await writeStore(store);
  return person;
}

export async function listFaceDetections(): Promise<FaceDetection[]> {
  if (hasDatabase()) {
    return listFaceDetectionsFromDb();
  }
  const store = await readStore();
  return [...(store.faceDetections || [])];
}

export async function getFaceDetection(
  faceId: string,
): Promise<FaceDetection | null> {
  if (hasDatabase()) {
    return getFaceDetectionFromDb(faceId);
  }
  const store = await readStore();
  return (
    (store.faceDetections || []).find((item) => item.faceId === faceId) || null
  );
}

export async function saveFaceDetection(
  detection: FaceDetection,
): Promise<void> {
  if (hasDatabase()) {
    await upsertFaceDetectionToDb(detection);
    return;
  }
  const store = await readStore();
  const list = [...(store.faceDetections || [])];
  const index = list.findIndex((item) => item.faceId === detection.faceId);
  if (index >= 0) list[index] = detection;
  else list.push(detection);
  store.faceDetections = list;
  await writeStore(store);
}

async function assignFaceToPerson(input: {
  faceId: string;
  imageId: string;
  boundingBox: FaceDetection["boundingBox"];
}): Promise<FacePerson> {
  const similar = await searchSimilarFaces({
    faceId: input.faceId,
    threshold: 92,
    maxFaces: 8,
  });

  let person: FacePerson | null = null;
  for (const match of similar) {
    const existingDetection = await getFaceDetection(match.faceId);
    if (!existingDetection) continue;
    person = await getFacePerson(existingDetection.personId);
    if (person) break;
  }

  const now = new Date().toISOString();
  if (!person) {
    person = {
      id: `person-${randomUUID().slice(0, 10)}`,
      name: "",
      representativeFaceId: input.faceId,
      faceIds: [input.faceId],
      imageIds: [input.imageId],
      createdAt: now,
      updatedAt: now,
    };
  } else {
    const faceIds = person.faceIds.includes(input.faceId)
      ? person.faceIds
      : [...person.faceIds, input.faceId];
    const imageIds = person.imageIds.includes(input.imageId)
      ? person.imageIds
      : [...person.imageIds, input.imageId];
    person = {
      ...person,
      faceIds,
      imageIds,
      updatedAt: now,
    };
  }

  await saveFacePerson(person);
  await saveFaceDetection({
    faceId: input.faceId,
    imageId: input.imageId,
    boundingBox: input.boundingBox,
    personId: person.id,
    createdAt: now,
  });
  return person;
}

/** Index one approved gallery image into Rekognition + cluster people. */
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
    const { faceCount, faces } = await indexGalleryImageFaces({
      imageId: image.id,
      src: image.src,
    });

    for (const face of faces) {
      await assignFaceToPerson({
        faceId: face.faceId,
        imageId: image.id,
        boundingBox: face.boundingBox,
      }).catch((error) =>
        console.error("assignFaceToPerson failed", face.faceId, error),
      );
    }

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
      error: awsErrorMessage(error),
      indexedAt: new Date().toISOString(),
    };
    await saveFaceImageIndex(entry);
    return entry;
  }
}

/** Best-effort index when face_find is on + AWS ready (admin upload / approve). */
export async function maybeIndexGalleryImage(
  image: GalleryImage,
): Promise<void> {
  try {
    const flags = await getFeatureFlags();
    const faceOn =
      isFeatureEnabled(flags, "main", "face_find") ||
      isFeatureEnabled(flags, "mehfil", "face_find") ||
      isFeatureEnabled(flags, "laavan", "face_find");
    if (!faceOn || !isRekognitionConfigured()) return;
    if (image.status !== "approved" || image.kind !== "image") return;

    const existing = await getFaceImageIndex(image.id);
    if (existing?.status === "indexed") return;

    await indexApprovedGalleryImage(image);
  } catch (error) {
    console.error("maybeIndexGalleryImage failed", image.id, error);
  }
}

export async function renameFacePerson(
  id: string,
  name: string,
): Promise<FacePerson> {
  const person = await getFacePerson(id);
  if (!person) throw new Error("Person not found");
  const updated: FacePerson = {
    ...person,
    name: name.trim(),
    updatedAt: new Date().toISOString(),
  };
  await saveFacePerson(updated);
  return updated;
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
