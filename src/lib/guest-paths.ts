import type { InviteContextValue } from "@/lib/invite-context";

export type GuestActionPath = "/rsvp" | "/wishes" | "/upload";

/** Main-site or invite-scoped path for guest action pages. */
export function guestActionPath(
  path: GuestActionPath,
  invite?: Pick<InviteContextValue, "basePath"> | null,
) {
  if (!invite?.basePath) return path;
  return `${invite.basePath}${path}`;
}

export function wishesWritePath(
  invite?: Pick<InviteContextValue, "basePath"> | null,
) {
  return `${guestActionPath("/wishes", invite)}#write-wish`;
}
