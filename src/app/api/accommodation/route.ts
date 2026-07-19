import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canRequestAccommodation,
  isAuthenticated,
} from "@/lib/auth";
import {
  addAccommodation,
  listAccommodations,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  phone: z.string().trim().min(7, "Phone number is required"),
  people: z.number().min(1).max(30),
  rooms: z.number().min(1).max(15),
  checkIn: z.string().trim().min(1, "Check-in date is required"),
  checkOut: z.string().trim().min(1, "Check-out date is required"),
  notes: z.string().max(500).optional(),
  contactFamily: z.string().optional(),
  rsvpId: z.string().optional(),
});

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accommodations = await listAccommodations();
  return NextResponse.json({ accommodations });
}

export async function POST(request: Request) {
  try {
    if (!(await canRequestAccommodation())) {
      return NextResponse.json(
        { error: "Please sign in with the guest code to request a stay" },
        { status: 401 },
      );
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid details" },
        { status: 400 },
      );
    }

    const requestEntry = await addAccommodation({
      name: parsed.data.name,
      phone: parsed.data.phone,
      people: parsed.data.people,
      rooms: parsed.data.rooms,
      checkIn: parsed.data.checkIn,
      checkOut: parsed.data.checkOut,
      notes: parsed.data.notes?.trim() || undefined,
      contactFamily: parsed.data.contactFamily?.trim() || undefined,
      rsvpId: parsed.data.rsvpId,
    });

    return NextResponse.json({ accommodation: requestEntry }, { status: 201 });
  } catch (error) {
    console.error("POST /api/accommodation failed", error);
    const message =
      error instanceof Error ? error.message : "Could not save request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
