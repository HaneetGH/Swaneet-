import { cookies } from "next/headers";
import { getDefaultAdminPin, verifyPin } from "@/lib/pin";
import type { VerifiedGuest } from "@/lib/firebase/admin";

export const ADMIN_COOKIE = "swaneet_admin";
export const VERIFIED_EMAIL_COOKIE = "swaneet_email_verified";
const TOKEN = "authenticated";

export async function getStoredPinHash() {
  // Lazy import avoids circular dependency with store/auth
  const { readStore } = await import("@/lib/store");
  const store = await readStore();
  return store.adminPinHash || null;
}

export async function verifyAdminPin(pin: string) {
  const storedHash = await getStoredPinHash();
  if (storedHash) {
    return verifyPin(pin, storedHash);
  }
  return pin === getDefaultAdminPin();
}

export async function isAuthenticated() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === TOKEN;
}

export function authCookieValue() {
  return TOKEN;
}

export async function getVerifiedEmailCookie() {
  const jar = await cookies();
  const value = jar.get(VERIFIED_EMAIL_COOKIE)?.value || "";
  return value.trim().toLowerCase() || null;
}

/** Admin dashboard session OR verified Google/phone Firebase user */
export async function resolveAccommodationUser(
  request: Request,
): Promise<{ kind: "admin" } | { kind: "guest"; user: VerifiedGuest } | null> {
  if (await isAuthenticated()) return { kind: "admin" };

  const { isFirebaseAdminConfigured, verifyBearerToken } = await import(
    "@/lib/firebase/admin"
  );
  if (!isFirebaseAdminConfigured()) return null;

  const user = await verifyBearerToken(request);
  if (!user) return null;
  return { kind: "guest", user };
}

/**
 * Email is verified when:
 * - Firebase Google login already has that email, or
 * - Guest completed email OTP (cookie matches)
 */
export async function isEmailVerifiedForRequest(
  email: string,
  guest: VerifiedGuest | null,
) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  if (guest?.email && guest.email.toLowerCase() === normalized) {
    return true;
  }

  const cookieEmail = await getVerifiedEmailCookie();
  return cookieEmail === normalized;
}
