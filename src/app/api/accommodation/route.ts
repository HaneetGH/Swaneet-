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
  listAccommodations,
  recordGuestLogin,
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
});

export async function GET() {
  if (!(await requirePermission("stay"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accommodations = await listAccommodations();
  return NextResponse.json({ accommodations });
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

    const requestEntry = await addAccommodation({
      name: parsed.data.name,
      phone: parsed.data.phone || guest?.phone || "",
      email: email || guest?.email || "",
      people: parsed.data.people,
      rooms: parsed.data.rooms,
      checkIn: parsed.data.checkIn,
      checkOut: parsed.data.checkOut,
      notes: parsed.data.notes?.trim() || undefined,
      contactFamily: parsed.data.contactFamily?.trim() || undefined,
      rsvpId: parsed.data.rsvpId,
      authUid: guest?.uid,
      authEmail: guest?.email,
      authPhone: guest?.phone,
      status: "pending",
    });

    if (guest) {
      await recordGuestLogin(guest, "stay").catch(() => undefined);
    }

    await notifyOwner({
      title: "New stay request",
      summary: `${requestEntry.name} requested accommodation.`,
      details: [
        `Name: ${requestEntry.name}`,
        `Phone: ${requestEntry.phone}`,
        `Email: ${requestEntry.email}`,
        `People: ${requestEntry.people} · Rooms: ${requestEntry.rooms}`,
        `Check-in: ${requestEntry.checkIn}`,
        `Check-out: ${requestEntry.checkOut}`,
        requestEntry.notes ? `Notes: ${requestEntry.notes}` : "",
      ],
    }).catch((error) => console.error("Stay owner notify failed", error));

    return NextResponse.json({ accommodation: requestEntry }, { status: 201 });
  } catch (error) {
    console.error("POST /api/accommodation failed", error);
    const message =
      error instanceof Error ? error.message : "Could not save request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
