import { cookies } from "next/headers";
import { getDefaultAdminPin, verifyPin } from "@/lib/pin";
import {
  isFirebaseAdminConfigured,
  verifyBearerToken,
  type VerifiedGuest,
} from "@/lib/firebase/admin";

export const ADMIN_COOKIE = "swaneet_admin";
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

/** Admin dashboard session OR verified Google/phone Firebase user */
export async function resolveAccommodationUser(
  request: Request,
): Promise<{ kind: "admin" } | { kind: "guest"; user: VerifiedGuest } | null> {
  if (await isAuthenticated()) return { kind: "admin" };

  if (!isFirebaseAdminConfigured()) return null;

  const user = await verifyBearerToken(request);
  if (!user) return null;
  return { kind: "guest", user };
}
