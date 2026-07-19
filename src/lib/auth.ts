import { cookies } from "next/headers";
import {
  getDefaultAdminPin,
  getDefaultGuestPin,
  verifyPin,
} from "@/lib/pin";

export const ADMIN_COOKIE = "swaneet_admin";
export const GUEST_COOKIE = "swaneet_guest";
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

export function verifyGuestPin(pin: string) {
  return pin === getDefaultGuestPin();
}

export async function isAuthenticated() {
  const jar = await cookies();
  return jar.get(ADMIN_COOKIE)?.value === TOKEN;
}

export async function isGuestAuthenticated() {
  const jar = await cookies();
  return jar.get(GUEST_COOKIE)?.value === TOKEN;
}

/** Admin or guest session — for accommodation requests */
export async function canRequestAccommodation() {
  return (await isAuthenticated()) || (await isGuestAuthenticated());
}

export function authCookieValue() {
  return TOKEN;
}
