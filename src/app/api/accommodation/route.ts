import { NextResponse } from "next/server";
import { z } from "zod";
import {
  isEmailVerifiedForRequest,
  requirePermission,
  resolveAccommodationUser,
} from "@/lib/auth";
import { isFirebaseAdminConfigured } from "@/lib/firebase/admin";
import {
  addAccommodation,
  getRoomInventory,
  listAccommodations,
  listHotels,
  recordGuestLogin,
  setTotalRooms,
  upsertAccommodationForGuest,
} from "@/lib/store";
import { notifyOwner } from "@/lib/email";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone: z.string().trim().min(7, "Phone number is required"),
  email: z.string().trim().email("A valid email is required for confirmation"),
  people: z.number().min(1).max(30),
  rooms: z.number().min(1).max(15),
  checkIn: z.string().trim().min(1, "Check-in date is required"),
  checkOut: z.string().trim().min(1, "Check-out date is required"),
  notes: z.string().max(500).optional(),
  contactFamily: z.string().optional(),
  rsvpId: z.string().optional(),
  inviteSide: z.enum(["bride", "groom"]).optional(),
  inviteTier: z.enum(["mehfil", "laavan"]).optional(),
  inviteSlug: z.string().trim().max(80).optional(),
});

const inventorySchema = z.object({
  totalRooms: z.coerce.number().int().min(0).max(500).optional(),
});

export async function GET() {
  if (!(await requirePermission("stay"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [accommodations, inventory, hotels] = await Promise.all([
    listAccommodations(),
    getRoomInventory(),
    listHotels(),
  ]);
  return NextResponse.json({ accommodations, inventory, hotels });
}

/** Legacy: set a single total when only one hotel exists. Prefer /api/accommodation/hotels. */
export async function PUT(request: Request) {
  try {
    if (!(await requirePermission("stay"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = inventorySchema.safeParse(await request.json());
    if (!parsed.success || typeof parsed.data.totalRooms !== "number") {
      return NextResponse.json(
        {
          error:
            "Add hotels under Stay → Hotels (name + rooms). A single total only works when one hotel exists.",
        },
        { status: 400 },
      );
    }
    const inventory = await setTotalRooms(parsed.data.totalRooms);
    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("PUT /api/accommodation inventory failed", error);
    const message =
      error instanceof Error ? error.message : "Could not save room total";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const identity = await resolveAccommodationUser(request);
    if (!identity) {
      const hint = isFirebaseAdminConfigured()
        ? "Please sign in with Google to request a stay"
        : "Sign-in is not configured yet. Add Firebase env vars on Vercel.";
      return NextResponse.json({ error: hint }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid details" },
        { status: 400 },
      );
    }

    const guest = identity.kind === "guest" ? identity.user : null;
    const email = parsed.data.email.trim().toLowerCase();

    if (identity.kind === "guest") {
      const verified = await isEmailVerifiedForRequest(email, guest);
      if (!verified) {
        return NextResponse.json(
          {
            error:
              "Please verify your email with the code we sent before submitting.",
          },
          { status: 400 },
        );
      }
    }

    let requestEntry;
    let updated = false;

    if (guest) {
      const result = await upsertAccommodationForGuest(
        { uid: guest.uid, email: guest.email, phone: guest.phone },
        {
          name: parsed.data.name,
          phone: parsed.data.phone || guest.phone || "",
          email: email || guest.email || "",
          people: parsed.data.people,
          rooms: parsed.data.rooms,
          checkIn: parsed.data.checkIn,
          checkOut: parsed.data.checkOut,
          notes: parsed.data.notes?.trim() || undefined,
          contactFamily: parsed.data.contactFamily?.trim() || undefined,
          rsvpId: parsed.data.rsvpId,
          status: "pending",
          inviteSide: parsed.data.inviteSide,
          inviteTier: parsed.data.inviteTier,
          inviteSlug: parsed.data.inviteSlug,
        },
      );
      requestEntry = result.accommodation;
      updated = result.updated;
      await recordGuestLogin(
        guest,
        "stay",
        parsed.data.inviteSlug
          ? `invite:${parsed.data.inviteSlug}`
          : undefined,
      ).catch(() => undefined);
    } else {
      requestEntry = await addAccommodation({
        name: parsed.data.name,
        phone: parsed.data.phone,
        email,
        people: parsed.data.people,
        rooms: parsed.data.rooms,
        checkIn: parsed.data.checkIn,
        checkOut: parsed.data.checkOut,
        notes: parsed.data.notes?.trim() || undefined,
        contactFamily: parsed.data.contactFamily?.trim() || undefined,
        rsvpId: parsed.data.rsvpId,
        status: "pending",
        inviteSide: parsed.data.inviteSide,
        inviteTier: parsed.data.inviteTier,
        inviteSlug: parsed.data.inviteSlug,
      });
    }

    await notifyOwner({
      title: updated ? "Stay request updated" : "New stay request",
      summary: `${requestEntry.name} ${updated ? "updated their" : "requested"} accommodation.`,
      details: [
        `Name: ${requestEntry.name}`,
        `Phone: ${requestEntry.phone}`,
        `Email: ${requestEntry.email}`,
        `People: ${requestEntry.people} · Rooms: ${requestEntry.rooms}`,
        `Check-in: ${requestEntry.checkIn}`,
        `Check-out: ${requestEntry.checkOut}`,
        requestEntry.notes ? `Notes: ${requestEntry.notes}` : "",
        requestEntry.inviteTier
          ? `Invite: bride / ${requestEntry.inviteTier}`
          : "",
      ],
    }).catch((error) => console.error("Stay owner notify failed", error));

    return NextResponse.json(
      { accommodation: requestEntry, updated },
      { status: updated ? 200 : 201 },
    );
  } catch (error) {
    console.error("POST /api/accommodation failed", error);
    const message =
      error instanceof Error ? error.message : "Could not save request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
