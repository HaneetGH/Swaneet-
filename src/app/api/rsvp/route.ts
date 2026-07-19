import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { addRsvp, listRsvps } from "@/lib/store";

export const dynamic = "force-dynamic";

const rsvpSchema = z.object({
  name: z.string().min(2),
  guests: z.coerce.number().min(1).max(20),
  attendance: z.enum(["yes", "no", "maybe"]),
  meal: z.enum(["vegetarian", "non-vegetarian", "no-preference"]).optional(),
  notes: z.string().max(500).optional(),
  contactFamily: z.string().optional(),
  needsAccommodation: z.boolean().optional(),
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
    const parsed = rsvpSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid RSVP details" },
        { status: 400 },
      );
    }

    const rsvp = await addRsvp({
      name: parsed.data.name.trim(),
      guests: parsed.data.guests,
      attendance: parsed.data.attendance,
      meal: parsed.data.meal,
      notes: parsed.data.notes?.trim() || undefined,
      contactFamily: parsed.data.contactFamily?.trim() || undefined,
      needsAccommodation: parsed.data.needsAccommodation ?? false,
    });

    return NextResponse.json({ rsvp }, { status: 201 });
  } catch (error) {
    console.error("POST /api/rsvp failed", error);
    const message =
      error instanceof Error ? error.message : "Could not save RSVP";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
