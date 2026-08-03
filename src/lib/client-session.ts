import type { AdminPermission } from "@/lib/types";

/** Client-safe permission check (mirrors server sessionHasPermission). */
export function sessionHasPermission(
  session: { permissions?: AdminPermission[] } | null | undefined,
  permission: AdminPermission,
) {
  return Boolean(session?.permissions?.includes(permission));
}
