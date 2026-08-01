import type { InviteContextValue } from "@/lib/invite-context";

export type GuestActionPath =
  | "/rsvp"
  | "/wishes"
  | "/upload"
  | "/my-account"
  | "/my-photos"
  | "/gallery";

type InvitePathInput =
  | Pick<InviteContextValue, "basePath">
  | { basePath?: string | null }
  | null
  | undefined;

/** Main-site or invite-scoped path for guest action pages. */
export function guestActionPath(path: GuestActionPath, invite?: InvitePathInput) {
  if (!invite?.basePath) return path;
  return `${invite.basePath}${path}`;
}

export function wishesWritePath(invite?: InvitePathInput) {
  return `${guestActionPath("/wishes", invite)}#write-wish`;
}

/** Public wishes wall path (server-safe; uses invite slug when present). */
export function wishesPublicPath(inviteSlug?: string | null) {
  const slug = inviteSlug?.trim();
  return slug ? `/i/${slug}/wishes` : "/wishes";
}

/** Absolute URL for a guest path, optionally invite-scoped. */
export function absoluteGuestUrl(
  path: GuestActionPath,
  options?: { siteUrl?: string; inviteSlug?: string | null },
) {
  const siteUrl = (options?.siteUrl || "").replace(/\/$/, "");
  const relative = options?.inviteSlug?.trim()
    ? `/i/${options.inviteSlug.trim()}${path}`
    : path;
  return siteUrl ? `${siteUrl}${relative}` : relative;
}
