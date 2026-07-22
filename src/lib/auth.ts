import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getDefaultAdminPin, verifyPin } from "@/lib/pin";
import {
  ALL_PERMISSIONS,
  memberUsername,
  normalizePermissions,
} from "@/lib/roles";
import type { AdminMember, AdminPermission } from "@/lib/types";
import type { VerifiedGuest } from "@/lib/firebase/admin";

export const ADMIN_COOKIE = "swaneet_admin";
export const VERIFIED_EMAIL_COOKIE = "swaneet_email_verified";

/** Legacy cookie value — treated as master */
const LEGACY_TOKEN = "authenticated";

export type AdminSession =
  | {
      kind: "master";
      name: string;
      permissions: AdminPermission[];
    }
  | {
      kind: "member";
      id: string;
      name: string;
      permissions: AdminPermission[];
    };

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.ADMIN_PIN ||
    "swaneet-admin-session"
  );
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret())
    .update(payload)
    .digest("hex")
    .slice(0, 32);
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function encodeAdminCookie(session: AdminSession) {
  if (session.kind === "master") {
    const payload = "v1.master";
    return `${payload}.${sign(payload)}`;
  }
  const payload = `v1.member.${session.id}`;
  return `${payload}.${sign(payload)}`;
}

/** @deprecated use encodeAdminCookie — kept for older imports */
export function authCookieValue() {
  return encodeAdminCookie({
    kind: "master",
    name: "Master",
    permissions: [...ALL_PERMISSIONS],
  });
}

export async function getStoredPinHash() {
  const { readStore } = await import("@/lib/store");
  const store = await readStore();
  return store.adminPinHash || null;
}

export async function verifyMasterPin(pin: string) {
  const storedHash = await getStoredPinHash();
  if (storedHash) {
    return verifyPin(pin, storedHash);
  }
  return pin === getDefaultAdminPin();
}

/** @deprecated prefer verifyMasterPin / loginWithCredentials */
export async function verifyAdminPin(pin: string) {
  return verifyMasterPin(pin);
}

/**
 * Master: PIN only (username empty or "master").
 * Team: firstname username + PIN must both match an active member.
 */
export async function loginWithCredentials(
  pin: string,
  username?: string,
): Promise<AdminSession | null> {
  const user = (username || "").trim().toLowerCase();

  if (!user || user === "master") {
    if (await verifyMasterPin(pin)) {
      return {
        kind: "master",
        name: "Master",
        permissions: [...ALL_PERMISSIONS],
      };
    }
    return null;
  }

  const { readStore } = await import("@/lib/store");
  const store = await readStore();
  const members = store.admins || [];
  for (const member of members) {
    if (!member.active) continue;
    if (memberUsername(member.name) !== user) continue;
    if (verifyPin(pin, member.pinHash)) {
      return {
        kind: "member",
        id: member.id,
        name: member.name,
        permissions: normalizePermissions(member.permissions),
      };
    }
  }
  return null;
}

/** @deprecated use loginWithCredentials */
export async function loginWithPin(
  pin: string,
): Promise<AdminSession | null> {
  return loginWithCredentials(pin);
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value || "";
  if (!raw) return null;

  if (raw === LEGACY_TOKEN) {
    return {
      kind: "master",
      name: "Master",
      permissions: [...ALL_PERMISSIONS],
    };
  }

  const parts = raw.split(".");
  if (parts[0] !== "v1") return null;

  if (parts[1] === "master" && parts.length === 3) {
    const payload = "v1.master";
    if (!safeEqual(parts[2], sign(payload))) return null;
    return {
      kind: "master",
      name: "Master",
      permissions: [...ALL_PERMISSIONS],
    };
  }

  if (parts[1] === "member" && parts.length === 4) {
    const id = parts[2];
    const payload = `v1.member.${id}`;
    if (!safeEqual(parts[3], sign(payload))) return null;

    const { readStore } = await import("@/lib/store");
    const store = await readStore();
    const member = (store.admins || []).find(
      (item: AdminMember) => item.id === id && item.active,
    );
    if (!member) return null;
    return {
      kind: "member",
      id: member.id,
      name: member.name,
      permissions: normalizePermissions(member.permissions),
    };
  }

  return null;
}

export async function isAuthenticated() {
  return Boolean(await getAdminSession());
}

export function sessionHasPermission(
  session: AdminSession | null,
  permission: AdminPermission,
) {
  if (!session) return false;
  if (session.kind === "master") return true;
  return session.permissions.includes(permission);
}

export async function requirePermission(permission: AdminPermission) {
  const session = await getAdminSession();
  if (!sessionHasPermission(session, permission)) return null;
  return session;
}

export async function requireAnyPermission(permissions: AdminPermission[]) {
  const session = await getAdminSession();
  if (!session) return null;
  if (session.kind === "master") return session;
  if (permissions.some((permission) => session.permissions.includes(permission))) {
    return session;
  }
  return null;
}

export async function requireMaster() {
  const session = await getAdminSession();
  if (!session || session.kind !== "master") return null;
  return session;
}

export async function getVerifiedEmailCookie() {
  const jar = await cookies();
  const value = jar.get(VERIFIED_EMAIL_COOKIE)?.value || "";
  return value.trim().toLowerCase() || null;
}

/** Admin dashboard session OR verified Google Firebase user */
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
