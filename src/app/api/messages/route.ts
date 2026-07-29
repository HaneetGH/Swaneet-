import { NextResponse } from "next/server";
import { z } from "zod";
import { buildDisplayWishPool, toPublicWishes } from "@/data/sample-wishes";
import {
  notifyOwner,
  sendGuestWishReceivedEmail,
} from "@/lib/email";
import {
  featureSiteFromInviteTier,
  isFeatureEnabled,
} from "@/lib/feature-flags";
import { isGuestAuthFailure, requireGuestAuth } from "@/lib/require-guest";
import { guestWishIdentity } from "@/lib/guest-wish-identity";
import {
  createGuestMessage,
  getFeatureFlags,
  listGuestMessages,
  recordGuestLogin,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  body: z.string().trim().min(12).max(400),
  inviteTier: z.enum(["mehfil", "laavan"]).optional(),
  inviteSlug: z.string().trim().max(80).optional(),
  inviteSide: z.enum(["bride", "groom"]).optional(),
});

/** Public approved wishes from the database (samples are seeded DB rows too). */
export async function GET() {
  try {
    const messages = await listGuestMessages();
    // Unique DB wishes: real first, samples still included (never hide samples for 1 real)
    return NextResponse.json({
      messages: buildDisplayWishPool(toPublicWishes(messages)),
    });
  } catch (error) {
    console.error("GET /api/messages failed", error);
    return NextResponse.json(
      { error: "Could not load wishes" },
      { status: 500 },
    );
  }
}

/** Guest posts a wish for bride & groom (starts pending). */
export async function POST(request: Request) {
  try {
    const guest = await requireGuestAuth(request);
    if (isGuestAuthFailure(guest)) return guest;

    const parsed = postSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid wish" },
        { status: 400 },
      );
    }

    const identity = guestWishIdentity(guest);
    if (!identity.ok) {
      return NextResponse.json({ error: identity.error }, { status: 400 });
    }

    const inviteSite = featureSiteFromInviteTier(parsed.data.inviteTier);
    const flags = await getFeatureFlags();
    if (!isFeatureEnabled(flags, inviteSite, "guest_messages")) {
      return NextResponse.json(
        { error: "Wishes are turned off for this invite right now" },
        { status: 403 },
      );
    }

    const { displayName } = identity;

    const message = await createGuestMessage({
      body: parsed.data.body,
      displayName,
      guest,
      inviteSite,
      inviteSide: parsed.data.inviteSide,
      inviteTier: parsed.data.inviteTier,
      inviteSlug: parsed.data.inviteSlug,
    });

    await recordGuestLogin(
      guest,
      "message",
      message.body.slice(0, 120),
    ).catch(() => undefined);

    await notifyOwner({
      title: "New guest wish",
      summary: `${displayName} left a message for Swaneet.`,
      details: [
        guest.email ? `Email: ${guest.email}` : "",
        `Site: ${inviteSite}`,
        parsed.data.inviteSlug ? `Invite: ${parsed.data.inviteSlug}` : "",
        "",
        message.body,
      ],
    }).catch((error) => console.error("Wish owner notify failed", error));

    await sendGuestWishReceivedEmail(message).catch((error) =>
      console.error("Wish received email failed", error),
    );

    return NextResponse.json({ message, pending: true }, { status: 201 });
  } catch (error) {
    const text =
      error instanceof Error ? error.message : "Could not share your wish";
    console.error("POST /api/messages failed", error);
    return NextResponse.json(
      { error: text },
      { status: text.includes("up to") ? 400 : 500 },
    );
  }
}
