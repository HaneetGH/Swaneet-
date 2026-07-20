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
  "events",
  "guests",
  "team",
];

export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  rsvp: "RSVPs",
  stay: "Accommodation / stay",
  gallery_upload: "Photos Upload",
  gallery_review: "Photos (approve & reject)",
  events: "Events",
  guests: "Logged-in guests",
  team: "Manage team (master tools)",
};

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
