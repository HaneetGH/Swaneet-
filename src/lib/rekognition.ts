import {
  CreateCollectionCommand,
  DescribeCollectionCommand,
  IndexFacesCommand,
  RekognitionClient,
  SearchFacesByImageCommand,
  SearchFacesCommand,
} from "@aws-sdk/client-rekognition";
import type { FaceBoundingBox } from "@/lib/types";

function awsEnv(name: string) {
  return process.env[name]?.trim() || "";
}

export function isRekognitionConfigured() {
  return Boolean(
    awsEnv("AWS_ACCESS_KEY_ID") &&
      awsEnv("AWS_SECRET_ACCESS_KEY") &&
      (awsEnv("AWS_REGION") || awsEnv("AWS_DEFAULT_REGION")),
  );
}

export function getRekognitionCollectionId() {
  return awsEnv("AWS_REKOGNITION_COLLECTION") || "swaneet-wedding-faces";
}

export function getAwsRegion() {
  return awsEnv("AWS_REGION") || awsEnv("AWS_DEFAULT_REGION") || "ap-south-1";
}

export function awsErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : String(error);
  }
  const e = error as {
    name?: string;
    message?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  const code = e.name || e.Code || "";
  const message = e.message || "AWS request failed";
  const status = e.$metadata?.httpStatusCode;
  if (code && message.includes(code)) return message;
  if (code) return `${code}: ${message}${status ? ` (${status})` : ""}`;
  return message;
}

function client() {
  return new RekognitionClient({
    region: getAwsRegion(),
    credentials: {
      accessKeyId: awsEnv("AWS_ACCESS_KEY_ID"),
      secretAccessKey: awsEnv("AWS_SECRET_ACCESS_KEY"),
    },
  });
}

let collectionReady = false;

function isAlreadyExistsError(error: unknown) {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name: string }).name)
      : "";
  return (
    name === "ResourceAlreadyExistsException" ||
    name === "ResourceInUseException"
  );
}

export async function ensureFaceCollection() {
  if (!isRekognitionConfigured()) {
    throw new Error(
      "Face find needs AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION on Vercel.",
    );
  }
  if (collectionReady) return;
  const collectionId = getRekognitionCollectionId();
  const rekognition = client();

  try {
    await rekognition.send(
      new DescribeCollectionCommand({ CollectionId: collectionId }),
    );
    collectionReady = true;
    return;
  } catch {
    // Collection missing — create it below
  }

  try {
    await rekognition.send(
      new CreateCollectionCommand({ CollectionId: collectionId }),
    );
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw new Error(
        `Could not create Rekognition collection "${collectionId}": ${awsErrorMessage(error)}. Check IAM allows rekognition:CreateCollection / DescribeCollection and AWS_REGION matches the key.`,
      );
    }
  }
  collectionReady = true;
}

/** Fetch image bytes from Blob URL or local public path. */
export async function fetchImageBytes(src: string): Promise<Uint8Array> {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(
        `Could not download image (${response.status}) from storage. Check the Blob URL is public.`,
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 15 * 1024 * 1024) {
      throw new Error(
        `Image is too large for Rekognition (${Math.round(bytes.byteLength / 1024 / 1024)}MB). Use photos under 15MB.`,
      );
    }
    if (bytes.byteLength < 100) {
      throw new Error("Downloaded image was empty or invalid");
    }
    return bytes;
  }

  if (src.startsWith("/uploads/")) {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", src);
    return new Uint8Array(await fs.readFile(filePath));
  }

  throw new Error(
    `Unsupported image source for face indexing: ${src.slice(0, 80)}`,
  );
}

export type IndexedFaceRecord = {
  faceId: string;
  boundingBox: FaceBoundingBox;
};

/**
 * Index all faces in a gallery photo.
 * ExternalImageId = gallery image id (used later to map matches back).
 */
export async function indexGalleryImageFaces(input: {
  imageId: string;
  src: string;
}): Promise<{ faceCount: number; faces: IndexedFaceRecord[] }> {
  await ensureFaceCollection();
  const bytes = await fetchImageBytes(input.src);
  const externalImageId = input.imageId.slice(0, 255);

  let result;
  try {
    result = await client().send(
      new IndexFacesCommand({
        CollectionId: getRekognitionCollectionId(),
        Image: { Bytes: bytes },
        ExternalImageId: externalImageId,
        DetectionAttributes: [],
        MaxFaces: 12,
        QualityFilter: "NONE",
      }),
    );
  } catch (error) {
    throw new Error(`IndexFaces failed: ${awsErrorMessage(error)}`);
  }

  const faces: IndexedFaceRecord[] = [];
  for (const record of result.FaceRecords || []) {
    const faceId = record.Face?.FaceId;
    const box = record.Face?.BoundingBox;
    if (!faceId || !box) continue;
    faces.push({
      faceId,
      boundingBox: {
        left: box.Left ?? 0,
        top: box.Top ?? 0,
        width: box.Width ?? 0,
        height: box.Height ?? 0,
      },
    });
  }

  return { faceCount: faces.length, faces };
}

/** Find similar faces already in the collection (for clustering into people). */
export async function searchSimilarFaces(input: {
  faceId: string;
  threshold?: number;
  maxFaces?: number;
}): Promise<Array<{ faceId: string; similarity: number }>> {
  await ensureFaceCollection();
  try {
    const result = await client().send(
      new SearchFacesCommand({
        CollectionId: getRekognitionCollectionId(),
        FaceId: input.faceId,
        FaceMatchThreshold: input.threshold ?? 92,
        MaxFaces: input.maxFaces ?? 10,
      }),
    );

    return (result.FaceMatches || [])
      .map((match) => ({
        faceId: match.Face?.FaceId || "",
        similarity: match.Similarity ?? 0,
      }))
      .filter((item) => item.faceId && item.faceId !== input.faceId);
  } catch (error) {
    console.error("searchSimilarFaces failed", awsErrorMessage(error));
    return [];
  }
}

/**
 * Search the wedding collection with a guest selfie.
 * Returns unique gallery image ids (ExternalImageId values).
 */
export async function searchGalleryImagesBySelfie(input: {
  selfieSrc: string;
  /** 0–100; higher = stricter */
  threshold?: number;
  maxFaces?: number;
}): Promise<{ imageIds: string[]; faceMatches: number }> {
  await ensureFaceCollection();
  const bytes = await fetchImageBytes(input.selfieSrc);

  const result = await client().send(
    new SearchFacesByImageCommand({
      CollectionId: getRekognitionCollectionId(),
      Image: { Bytes: bytes },
      FaceMatchThreshold: input.threshold ?? 85,
      MaxFaces: input.maxFaces ?? 100,
    }),
  );

  const imageIds = new Set<string>();
  for (const match of result.FaceMatches || []) {
    const external = match.Face?.ExternalImageId?.trim();
    if (external) imageIds.add(external);
  }

  return {
    imageIds: [...imageIds],
    faceMatches: result.FaceMatches?.length || 0,
  };
}
