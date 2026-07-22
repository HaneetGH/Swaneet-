import { createHmac, timingSafeEqual } from "crypto";
import {
  createGalleryAccessToken,
  toProxiedGalleryImages,
} from "@/lib/gallery-access";
import type { FeatureSite, GalleryImage } from "@/lib/types";

const SHARE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function shareSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PIN ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    "swaneet-face-share"
  );
}

function sign(payload: string) {
  return createHmac("sha256", shareSecret())
    .update(payload)
    .digest("base64url");
}

export type FaceShareClaims = {
  /** Face person album */
  personId?: string;
  /** Explicit image ids (guest matches / selfie search) */
  imageIds?: string[];
  email?: string;
  name?: string;
  exp: number;
};

export function createFaceShareToken(
  claims: Omit<FaceShareClaims, "exp"> & { ttlMs?: number },
): string {
  const exp = Date.now() + (claims.ttlMs ?? SHARE_TTL_MS);
  const body = Buffer.from(
    JSON.stringify({
      personId: claims.personId,
      imageIds: claims.imageIds?.slice(0, 200),
      email: claims.email,
      name: claims.name,
      exp,
    } satisfies FaceShareClaims),
    "utf8",
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyFaceShareToken(
  token: string | null | undefined,
): FaceShareClaims | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as FaceShareClaims;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    if (!parsed.personId && !(parsed.imageIds && parsed.imageIds.length)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://swaneet.vercel.app")
  );
}

export function faceSharePageUrl(token: string) {
  return `${siteUrl()}/shared-photos?t=${encodeURIComponent(token)}`;
}

/** Proxied album images for a share page (short media access). */
export function proxiedShareAlbum(
  images: GalleryImage[],
  site: FeatureSite = "main",
) {
  const access = createGalleryAccessToken("face-share", site);
  return toProxiedGalleryImages(images, access);
}
