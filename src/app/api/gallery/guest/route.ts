import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyBearerToken } from "@/lib/firebase/admin";
import { notifyOwner } from "@/lib/email";
import { resolveGuestEvent } from "@/lib/guest-event";
import { readStore, recordGuestLogin, writeStore } from "@/lib/store";
import type { GalleryImage } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_FILES = 5;

const schema = z
  .object({
    eventId: z.string().trim().optional().default(""),
    newEventName: z.string().trim().max(80).optional().default(""),
    inviteTier: z.enum(["mehfil", "laavan"]).optional(),
    media: z
      .array(
        z.object({
          src: z.string().trim().url(),
          alt: z.string().optional().default(""),
          aspect: z
            .enum(["portrait", "landscape", "square"])
            .default("square"),
        }),
      )
      .min(1)
      .max(MAX_FILES),
  })
  .refine((data) => Boolean(data.eventId || data.newEventName), {
    message: "Choose an event or create a new one",
  });

export async function POST(request: Request) {
  try {
    const guest = await verifyBearerToken(request);
    if (!guest) {
      return NextResponse.json(
        { error: "Please sign in with Google to share photos" },
        { status: 401 },
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid photos" },
        { status: 400 },
      );
    }

    const { getFeatureFlags } = await import("@/lib/store");
    const {
      featureSiteFromInviteTier,
      isFeatureEnabled,
    } = await import("@/lib/feature-flags");
    const flags = await getFeatureFlags();
    const site = featureSiteFromInviteTier(parsed.data.inviteTier);
    if (!isFeatureEnabled(flags, site, "guest_photos")) {
      return NextResponse.json(
        { error: "Guest photo uploads are turned off for this invite" },
        { status: 403 },
      );
    }

    let store = await readStore();
    let eventId = "";
    let createdEvent = undefined as ReturnType<
      typeof resolveGuestEvent
    >["created"];

    try {
      const resolved = resolveGuestEvent(store, {
        eventId: parsed.data.eventId,
        newEventName: parsed.data.newEventName,
      });
      store = resolved.store;
      eventId = resolved.eventId;
      createdEvent = resolved.created;
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Could not assign event",
        },
        { status: 400 },
      );
    }

    const images: GalleryImage[] = parsed.data.media.map((item, index) => ({
      id: randomUUID(),
      eventId,
      src: item.src,
      aspect: item.aspect,
      kind: "image" as const,
      status: "pending" as const,
      source: "guest" as const,
      uploadedByUid: guest.uid,
      uploadedByEmail: guest.email,
      uploadedByName: guest.name,
      alt:
        item.alt ||
        (guest.name
          ? `From ${guest.name}${parsed.data.media.length > 1 ? ` (${index + 1})` : ""}`
          : `Guest photo${parsed.data.media.length > 1 ? ` (${index + 1})` : ""}`),
      createdAt: new Date().toISOString(),
    }));

    store.gallery = [...images, ...store.gallery];
    await writeStore(store);
    await recordGuestLogin(guest, "photos").catch(() => undefined);

    const eventName =
      store.events.find((event) => event.id === eventId)?.name || eventId;

    await notifyOwner({
      title: "New guest photos",
      summary: `${guest.name || guest.email || "A guest"} shared ${images.length} photo(s) for review.`,
      details: [
        guest.name ? `Name: ${guest.name}` : "",
        guest.email ? `Email: ${guest.email}` : "",
        `Event: ${eventName}`,
        `Photos: ${images.length}`,
        createdEvent ? `New event created: ${createdEvent.name}` : "",
      ],
    }).catch((error) => console.error("Photo owner notify failed", error));

    return NextResponse.json(
      { images, pending: true, eventId, createdEvent },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/gallery/guest failed", error);
    return NextResponse.json(
      { error: "Could not share photos" },
      { status: 500 },
    );
  }
}
