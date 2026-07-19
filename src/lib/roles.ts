import type { AdminPermission } from "@/lib/types";

export const ALL_PERMISSIONS: AdminPermission[] = [
  "rsvp",
  "stay",
  "gallery",
  "events",
  "guests",
  "team",
];

export const PERMISSION_LABELS: Record<AdminPermission, string> = {
  rsvp: "RSVPs",
  stay: "Accommodation / stay",
  gallery: "Photos (approve & upload)",
  events: "Events",
  guests: "Logged-in guests",
  team: "Manage team (master tools)",
};

export function normalizePermissions(
  permissions: AdminPermission[] | undefined,
): AdminPermission[] {
  const allowed = new Set(ALL_PERMISSIONS);
  return [...new Set(permissions || [])].filter((p) =>
    allowed.has(p),
  ) as AdminPermission[];
}
