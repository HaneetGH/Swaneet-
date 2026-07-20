import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { notifyOwner } from "@/lib/email";
import { verifyBearerToken } from "@/lib/firebase/admin";
import {
  findAccommodationByGuest,
  listRsvps,
  recordGuestLogin,
  upsertAccommodationForGuest,
  upsertRsvpForGuest,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const staySchema = z.object({
  phone: z.string().trim().min(7, "Phone number is required"),
  people: z.number().min(1).max(30),
  rooms: z.number().min(1).max(15),
  checkIn: z.string().trim().min(1),
  checkOut: z.string().trim().min(1),
  notes: z.string().max(500).optional(),
});

const rsvpSchema = z
  .object({
    name: z.string().min(2),
    guests: z.coerce.number().min(1).max(20),
    attendance: z.enum(["yes", "no", "maybe"]),
    meal: z.enum(["vegetarian", "non-vegetarian", "no-preference"]).optional(),
    notes: z.string().max(500).optional(),
    contactFamily: z.string().optional(),
    needsAccommodation: z.boolean(),
    inviteSide: z.enum(["bride", "groom"]).optional(),
    inviteTier: z.enum(["mehfil", "laavan"]).optional(),
    inviteSlug: z.string().trim().max(80).optional(),
    stay: staySchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.needsAccommodation && !data.stay) {
      ctx.addIssue({
        code: "custom",
        message: "Stay details are required when you need accommodation",
        path: ["stay"],
      });
    }
  });

export async function GET() {
  try {
    if (!(await requirePermission("rsvp"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rsvps = await listRsvps();
    return NextResponse.json({ rsvps });
  } catch (error) {
    console.error("GET /api/rsvp failed", error);
    return NextResponse.json({ error: "Could not load RSVPs" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const guest = await verifyBearerToken(request);
    if (!guest) {
      return NextResponse.json(
        { error: "Please sign in with Google to RSVP" },
        { status: 401 },
      );
    }
    if (!guest.email) {
      return NextResponse.json(
        { error: "Your Google account needs an email address to RSVP" },
        { status: 400 },
      );
    }

    const parsed = rsvpSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          error:
            parsed.error.issues[0]?.message || "Invalid RSVP details",
        },
        { status: 400 },
      );
    }

    const { rsvp, updated } = await upsertRsvpForGuest(
      { uid: guest.uid, email: guest.email },
      {
        name: parsed.data.name.trim(),
        guests: parsed.data.guests,
        attendance: parsed.data.attendance,
        meal: parsed.data.meal,
        notes: parsed.data.notes?.trim() || undefined,
        contactFamily: parsed.data.contactFamily?.trim() || undefined,
        needsAccommodation: parsed.data.needsAccommodation,
        inviteSide: parsed.data.inviteSide,
        inviteTier: parsed.data.inviteTier,
        inviteSlug: parsed.data.inviteSlug,
      },
    );

    await recordGuestLogin(
      guest,
      "rsvp",
      parsed.data.inviteSlug
        ? `invite:${parsed.data.inviteSlug}`
        : undefined,
    ).catch(() => undefined);

    let accommodation = null;
    let stayUpdated = false;

    if (parsed.data.needsAccommodation && parsed.data.stay) {
      const stayResult = await upsertAccommodationForGuest(
        { uid: guest.uid, email: guest.email },
        {
          name: parsed.data.name.trim(),
          phone: parsed.data.stay.phone,
          email: guest.email,
          people: parsed.data.stay.people,
          rooms: parsed.data.stay.rooms,
          checkIn: parsed.data.stay.checkIn,
          checkOut: parsed.data.stay.checkOut,
          notes: parsed.data.stay.notes?.trim() || undefined,
          contactFamily: parsed.data.contactFamily?.trim() || undefined,
          rsvpId: rsvp.id,
          status: "pending",
          inviteSide: parsed.data.inviteSide,
          inviteTier: parsed.data.inviteTier,
          inviteSlug: parsed.data.inviteSlug,
        },
      );
      accommodation = stayResult.accommodation;
      stayUpdated = stayResult.updated;
      await recordGuestLogin(guest, "stay").catch(() => undefined);
    } else {
      // Still return existing stay if they previously requested one
      accommodation = await findAccommodationByGuest(guest.uid, guest.email);
    }

    const action = updated ? "updated" : "new";
    await notifyOwner({
      title: parsed.data.needsAccommodation
        ? updated
          ? "RSVP + stay updated"
          : "New RSVP + stay request"
        : updated
          ? "RSVP updated"
          : "New RSVP",
      summary: `${rsvp.name} ${updated ? "updated their" : "submitted an"} RSVP${
        parsed.data.needsAccommodation ? " and accommodation" : ""
      }.`,
      details: [
        `Name: ${rsvp.name}`,
        `Email: ${guest.email}`,
        `Guests: ${rsvp.guests}`,
        `Attendance: ${rsvp.attendance}`,
        rsvp.meal ? `Meal: ${rsvp.meal}` : "",
        rsvp.needsAccommodation ? "Needs accommodation: yes" : "Needs accommodation: no",
        accommodation
          ? `Stay: ${accommodation.people} people, ${accommodation.rooms} room(s), ${accommodation.checkIn} → ${accommodation.checkOut}${stayUpdated ? " (updated)" : ""}`
          : "",
        accommodation?.phone ? `Phone: ${accommodation.phone}` : "",
        rsvp.notes ? `Notes: ${rsvp.notes}` : "",
        rsvp.contactFamily ? `Contact: ${rsvp.contactFamily}` : "",
        rsvp.inviteTier
          ? `Invite: bride / ${rsvp.inviteTier}${rsvp.inviteSlug ? ` (${rsvp.inviteSlug})` : ""}`
          : "",
      ],
    }).catch((error) => console.error("RSVP owner notify failed", error));

    return NextResponse.json(
      {
        rsvp,
        accommodation,
        updated,
        stayUpdated,
        action,
      },
      { status: updated ? 200 : 201 },
    );
  } catch (error) {
    console.error("POST /api/rsvp failed", error);
    const message =
      error instanceof Error ? error.message : "Could not save RSVP";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
