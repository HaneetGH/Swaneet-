import type { AdminPermission } from "@/lib/types";

/** First name → login username (case-insensitive) */
export function memberUsername(name: string) {
  return name.trim().split(/\s+/)[0]?.toLowerCase() || "";
}

export const ALL_PERMISSIONS: AdminPermission[] = [
  "rsvp",
  "stay",
  "gallery_upload",
  "gallery_review",
  "faces",
  "events",
  "guests",
  "messages",
  "team",
];

export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  rsvp: "RSVPs",
  stay: "Accommodation / stay",
  gallery_upload: "Photos Upload (dashboard + /photographer)",
  gallery_review: "Photos (approve & reject)",
  faces: "Faces (index, merge, email photo links)",
  events: "Events",
  guests: "Logged-in guests",
  messages: "Wishes (approve & reject)",
  team: "Manage team (master tools)",
};

/** Upload-only photographer accounts — no RSVP/stay/team access */
export const PHOTOGRAPHER_PERMISSIONS: AdminPermission[] = ["gallery_upload"];

export function isPhotographerOnly(
  permissions: AdminPermission[] | undefined,
) {
  const set = new Set(permissions || []);
  return set.size === 1 && set.has("gallery_upload");
}

/** Expand legacy `gallery` into upload + review; drop unknown keys */
export function normalizePermissions(
  permissions: Array<AdminPermission | "gallery" | string> | undefined,
): AdminPermission[] {
  const expanded: string[] = [];
  for (const permission of permissions || []) {
    if (permission === "gallery") {
      expanded.push("gallery_upload", "gallery_review");
    } else {
      expanded.push(permission);
    }
  }
  const allowed = new Set<string>(ALL_PERMISSIONS);
  return [...new Set(expanded)].filter((permission) =>
    allowed.has(permission),
  ) as AdminPermission[];
}
