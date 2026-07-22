import {
  CreateCollectionCommand,
  IndexFacesCommand,
  RekognitionClient,
  ResourceAlreadyExistsException,
  SearchFacesByImageCommand,
} from "@aws-sdk/client-rekognition";

export function isRekognitionConfigured() {
  return Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      (process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION),
  );
}

export function getRekognitionCollectionId() {
  return (
    process.env.AWS_REKOGNITION_COLLECTION?.trim() || "swaneet-wedding-faces"
  );
}

function client() {
  const region =
    process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "ap-south-1";
  return new RekognitionClient({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

let collectionReady = false;

export async function ensureFaceCollection() {
  if (!isRekognitionConfigured()) {
    throw new Error(
      "Face find needs AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION on Vercel.",
    );
  }
  if (collectionReady) return;
  const collectionId = getRekognitionCollectionId();
  try {
    await client().send(
      new CreateCollectionCommand({ CollectionId: collectionId }),
    );
  } catch (error) {
    if (!(error instanceof ResourceAlreadyExistsException)) {
      // Some SDKs throw plain errors with name
      const name =
        error && typeof error === "object" && "name" in error
          ? String((error as { name: string }).name)
          : "";
      if (name !== "ResourceAlreadyExistsException") throw error;
    }
  }
  collectionReady = true;
}

/** Fetch image bytes from Blob URL or local public path. */
export async function fetchImageBytes(src: string): Promise<Uint8Array> {
  if (src.startsWith("http://") || src.startsWith("https://")) {
    const response = await fetch(src);
    if (!response.ok) {
      throw new Error(`Could not download image (${response.status})`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  if (src.startsWith("/uploads/")) {
    const { promises: fs } = await import("fs");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", src);
    return new Uint8Array(await fs.readFile(filePath));
  }

  throw new Error("Unsupported image source for face indexing");
}

/**
 * Index all faces in a gallery photo.
 * ExternalImageId = gallery image id (used later to map matches back).
 */
export async function indexGalleryImageFaces(input: {
  imageId: string;
  src: string;
}): Promise<{ faceCount: number }> {
  await ensureFaceCollection();
  const bytes = await fetchImageBytes(input.src);
  const externalImageId = input.imageId.slice(0, 255);

  const result = await client().send(
    new IndexFacesCommand({
      CollectionId: getRekognitionCollectionId(),
      Image: { Bytes: bytes },
      ExternalImageId: externalImageId,
      DetectionAttributes: [],
      MaxFaces: 12,
      QualityFilter: "AUTO",
    }),
  );

  return { faceCount: result.FaceRecords?.length || 0 };
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
