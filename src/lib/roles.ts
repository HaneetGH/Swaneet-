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

/** Permissions a master can assign to team members (not `team`). */
export const ASSIGNABLE_PERMISSIONS: AdminPermission[] = [
  "rsvp",
  "stay",
  "gallery_upload",
  "gallery_review",
  "faces",
  "events",
  "guests",
  "messages",
];

export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  rsvp: "RSVPs",
  stay: "Accommodation / stay",
  gallery_upload: "Photos Upload",
  gallery_review: "Photos (approve & reject)",
  faces: "Faces (index, merge, email photo links)",
  events: "Events",
  guests: "Logged-in guests",
  messages: "Wishes (approve & reject)",
  team: "Manage team (master tools)",
};

export type TeamRolePresetId = "photographer" | "custom";

export type TeamRolePreset = {
  id: TeamRolePresetId;
  label: string;
  hint: string;
  /** Empty = pick permissions manually */
  permissions: AdminPermission[];
};

/** Quick roles when inviting team members from the dashboard. */
export const TEAM_ROLE_PRESETS: TeamRolePreset[] = [
  {
    id: "photographer",
    label: "Photographer",
    hint: "Upload wedding photos and approve or reject gallery items — no RSVP, stay, or settings access",
    permissions: ["gallery_upload", "gallery_review"],
  },
  {
    id: "custom",
    label: "Custom",
    hint: "Choose individual permissions",
    permissions: [],
  },
];

export const PHOTOGRAPHER_PERMISSIONS: AdminPermission[] = [
  "gallery_upload",
  "gallery_review",
];

function sortedPermKey(permissions: AdminPermission[]) {
  return [...permissions].sort().join(",");
}

/** Detect a known role preset from a permission list (exact match). */
export function matchTeamRolePreset(
  permissions: AdminPermission[],
): TeamRolePreset | null {
  const key = sortedPermKey(normalizePermissions(permissions));
  for (const preset of TEAM_ROLE_PRESETS) {
    if (!preset.permissions.length) continue;
    if (sortedPermKey(preset.permissions) === key) return preset;
  }
  return null;
}

export function isPhotographerRole(permissions: AdminPermission[]) {
  return matchTeamRolePreset(permissions)?.id === "photographer";
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
