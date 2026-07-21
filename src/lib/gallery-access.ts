import { createHmac, timingSafeEqual } from "crypto";
import type { FeatureSite, GalleryImage } from "@/lib/types";

const TOKEN_TTL_MS = 45 * 60 * 1000; // 45 minutes — must re-login/refresh gallery to renew

function accessSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PIN ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    "swaneet-gallery-access"
  );
}

function sign(payload: string) {
  return createHmac("sha256", accessSecret())
    .update(payload)
    .digest("base64url");
}

export type GalleryAccessClaims = {
  uid: string;
  site: FeatureSite;
  exp: number;
};

/** Short-lived token so <img>/<video> can load without Bearer headers. */
export function createGalleryAccessToken(
  uid: string,
  site: FeatureSite = "main",
): string {
  const exp = Date.now() + TOKEN_TTL_MS;
  const body = `${uid}|${site}|${exp}`;
  return `${body}.${sign(body)}`;
}

export function verifyGalleryAccessToken(
  token: string | null | undefined,
): GalleryAccessClaims | null {
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

  const [uid, site, expRaw] = body.split("|");
  const exp = Number(expRaw);
  if (!uid || !site || !Number.isFinite(exp) || Date.now() > exp) return null;
  if (site !== "main" && site !== "mehfil" && site !== "laavan") return null;

  return { uid, site, exp };
}

/** Rewrite storage URLs to the authenticated media proxy. */
export function toProxiedGalleryImage(
  image: GalleryImage,
  accessToken?: string | null,
): GalleryImage {
  const params = new URLSearchParams();
  if (accessToken) params.set("access", accessToken);
  const query = params.toString();
  return {
    ...image,
    src: `/api/gallery/file/${encodeURIComponent(image.id)}${
      query ? `?${query}` : ""
    }`,
  };
}

export function toProxiedGalleryImages(
  images: GalleryImage[],
  accessToken?: string | null,
): GalleryImage[] {
  return images.map((image) => toProxiedGalleryImage(image, accessToken));
}
