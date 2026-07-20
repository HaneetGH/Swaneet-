"use client";

import { getGuestIdToken } from "@/components/rsvp/GuestAuthPanel";
import type { GuestActivityAction } from "@/lib/types";

/** Fire-and-forget activity ping for a signed-in guest. */
export async function trackGuestActivity(
  action: GuestActivityAction,
  detail?: string,
) {
  try {
    const token = await getGuestIdToken();
    if (!token) return;
    await fetch("/api/guests/activity", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, detail }),
    });
  } catch {
    // tracking must never block the guest UI
  }
}
