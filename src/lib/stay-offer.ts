import { createHmac, timingSafeEqual } from "crypto";
import { siteUrl } from "@/lib/face-share";

const OFFER_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function offerSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PIN ||
    process.env.BLOB_READ_WRITE_TOKEN ||
    "swaneet-stay-offer"
  );
}

function sign(payload: string) {
  return createHmac("sha256", offerSecret())
    .update(payload)
    .digest("base64url");
}

export type StayOfferClaims = {
  stayId: string;
  checkIn: string;
  checkOut: string;
  action?: "accept" | "decline";
  exp: number;
};

export function createStayOfferToken(
  claims: Omit<StayOfferClaims, "exp"> & { ttlMs?: number },
): string {
  const exp = Date.now() + (claims.ttlMs ?? OFFER_TTL_MS);
  const body = Buffer.from(
    JSON.stringify({
      stayId: claims.stayId,
      checkIn: claims.checkIn,
      checkOut: claims.checkOut,
      action: claims.action,
      exp,
    } satisfies StayOfferClaims),
    "utf8",
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyStayOfferToken(
  token: string | null | undefined,
): StayOfferClaims | null {
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
    ) as StayOfferClaims;
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    if (!parsed.stayId || !parsed.checkIn || !parsed.checkOut) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function stayOfferPageUrl(token: string) {
  return `${siteUrl()}/stay-offer?t=${encodeURIComponent(token)}`;
}
