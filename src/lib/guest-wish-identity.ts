import type { VerifiedGuest } from "@/lib/firebase/admin";

/**
 * Wish posts use Google sign-in only — name + email come from the token,
 * never from client form fields.
 */
export function guestWishIdentity(guest: VerifiedGuest):
  | { ok: true; displayName: string; email: string }
  | { ok: false; error: string } {
  const email = guest.email?.trim();
  if (!email) {
    return {
      ok: false,
      error: "Your Google account needs an email to share a wish.",
    };
  }

  const displayName =
    guest.name?.trim() || email.split("@")[0]?.trim() || "Guest";

  return { ok: true, displayName, email };
}
