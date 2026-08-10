import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { sendAccommodationEmail } from "@/lib/email";
import {
  addAccommodation,
  getRoomInventory,
  listHotels,
  updateAccommodation,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const assignSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("A valid email is required"),
  phone: z.string().trim().max(40).optional().default(""),
  people: z.coerce.number().int().min(1).max(30),
  rooms: z.coerce.number().int().min(1).max(15),
  hotelId: z.string().trim().min(1, "Select a hotel"),
  roomsAssigned: z.coerce.number().int().min(1).max(30).optional(),
  checkIn: z.string().trim().min(1, "Check-in date is required"),
  checkOut: z.string().trim().min(1, "Check-out date is required"),
  roomDetails: z.string().trim().max(500).optional().default(""),
  adminNotes: z.string().trim().max(500).optional().default(""),
  useBlockedRooms: z.boolean().optional().default(false),
  sendEmail: z.boolean().optional().default(false),
});

/**
 * Master/team with stay permission: create a stay and confirm room assignment
 * in one step (no guest request required).
 */
export async function POST(request: Request) {
  try {
    if (!(await requirePermission("stay"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = assignSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid details" },
        { status: 400 },
      );
    }

    const data = parsed.data;
    if (data.checkOut <= data.checkIn) {
      return NextResponse.json(
        { error: "Check-out must be after check-in" },
        { status: 400 },
      );
    }

    const hotels = await listHotels();
    const hotel = hotels.find((item) => item.id === data.hotelId);
    if (!hotel) {
      return NextResponse.json({ error: "Hotel not found" }, { status: 404 });
    }

    const roomsAssigned = data.roomsAssigned ?? data.rooms;
    const email = data.email.trim().toLowerCase();
    const phone = data.phone.trim() || "—";

    const created = await addAccommodation({
      name: data.name.trim(),
      phone,
      email,
      people: data.people,
      rooms: data.rooms,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      requestedCheckIn: data.checkIn,
      requestedCheckOut: data.checkOut,
      notes: "Assigned directly from dashboard",
      adminNotes: data.adminNotes.trim() || undefined,
      status: "pending",
      inviteSite: "main",
    });

    const now = new Date().toISOString();
    let confirmed;
    try {
      confirmed = await updateAccommodation(
        created.id,
        {
          status: "confirmed",
          hotelId: hotel.id,
          hotelName: hotel.name,
          hotelAddress: hotel.address || undefined,
          roomDetails: data.roomDetails.trim() || undefined,
          adminNotes: data.adminNotes.trim() || undefined,
          email,
          roomsAssigned,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          requestedCheckIn: data.checkIn,
          requestedCheckOut: data.checkOut,
          confirmedAt: now,
          offerStatus: "accepted",
        },
        { useBlockedRooms: data.useBlockedRooms },
      );
    } catch (error) {
      // Roll back the pending stub if inventory rejects the assign.
      const { deleteAccommodation } = await import("@/lib/store");
      await deleteAccommodation(created.id).catch(() => undefined);
      throw error;
    }

    if (!confirmed) {
      return NextResponse.json(
        { error: "Could not confirm room assignment" },
        { status: 500 },
      );
    }

    const inventory = await getRoomInventory();
    let emailResult: { sent: boolean; error?: string } = { sent: false };

    if (data.sendEmail) {
      const mailed = await sendAccommodationEmail(confirmed);
      if (mailed.ok) {
        const withEmail = await updateAccommodation(confirmed.id, {
          emailSentAt: now,
        });
        return NextResponse.json(
          {
            accommodation: withEmail || confirmed,
            inventory,
            email: { sent: true },
          },
          { status: 201 },
        );
      }
      emailResult = { sent: false, error: mailed.error };
    }

    return NextResponse.json(
      {
        accommodation: confirmed,
        inventory,
        email: emailResult,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/accommodation/assign failed", error);
    const message =
      error instanceof Error ? error.message : "Could not assign room";
    const status =
      message.includes("Not enough") ||
      message.includes("blocked") ||
      message.includes("requires a hotel")
        ? 409
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
