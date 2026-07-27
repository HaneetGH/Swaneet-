import { NextResponse } from "next/server";
import { z } from "zod";
import { notifyOwner } from "@/lib/email";
import {
  featureSiteFromInviteTier,
  isFeatureEnabled,
} from "@/lib/feature-flags";
import { isGuestAuthFailure, requireGuestAuth } from "@/lib/require-guest";
import {
  deleteGuestMessageForGuest,
  getFeatureFlags,
  updateGuestMessageForGuest,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  body: z.string().trim().min(12).max(400),
  displayName: z.string().trim().min(2).max(60).optional(),
  inviteTier: z.enum(["mehfil", "laavan"]).optional(),
});

function statusFromError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
  ) {
    return (error as { status: number }).status;
  }
  return 500;
}

type RouteContext = { params: Promise<{ id: string }> };

/** Guest updates one of their wishes (returns to pending review). */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const guest = await requireGuestAuth(request);
    if (isGuestAuthFailure(guest)) return guest;

    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Wish id required" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid wish" },
        { status: 400 },
      );
    }

    const inviteSite = featureSiteFromInviteTier(parsed.data.inviteTier);
    const flags = await getFeatureFlags();
    if (!isFeatureEnabled(flags, inviteSite, "guest_messages")) {
      return NextResponse.json(
        { error: "Wishes are turned off for this invite right now" },
        { status: 403 },
      );
    }

    const displayName =
      parsed.data.displayName ||
      guest.name?.trim() ||
      guest.email?.split("@")[0] ||
      "Guest";

    const message = await updateGuestMessageForGuest({
      id: id.trim(),
      guest,
      body: parsed.data.body,
      displayName,
    });

    await notifyOwner({
      title: "Guest wish updated",
      summary: `${displayName} edited a wish — needs review again.`,
      details: [
        guest.email ? `Email: ${guest.email}` : "",
        `Site: ${message.inviteSite || inviteSite}`,
        "",
        message.body,
      ],
    }).catch((error) => console.error("Wish edit notify failed", error));

    return NextResponse.json({ message, pending: true });
  } catch (error) {
    const text =
      error instanceof Error ? error.message : "Could not update your wish";
    console.error("PATCH /api/messages/[id] failed", error);
    return NextResponse.json({ error: text }, { status: statusFromError(error) });
  }
}

/** Guest removes one of their wishes. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const guest = await requireGuestAuth(_request);
    if (isGuestAuthFailure(guest)) return guest;

    const { id } = await context.params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Wish id required" }, { status: 400 });
    }

    const removed = await deleteGuestMessageForGuest({
      id: id.trim(),
      guest,
    });
    if (!removed) {
      return NextResponse.json({ error: "Wish not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const text =
      error instanceof Error ? error.message : "Could not remove your wish";
    console.error("DELETE /api/messages/[id] failed", error);
    return NextResponse.json({ error: text }, { status: statusFromError(error) });
  }
}
