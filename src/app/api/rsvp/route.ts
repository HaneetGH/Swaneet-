import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { addRsvp, listRsvps } from "@/lib/store";

const rsvpSchema = z.object({
  name: z.string().min(2),
  guests: z.number().min(1).max(20),
  attendance: z.enum(["yes", "no", "maybe"]),
  meal: z.enum(["vegetarian", "non-vegetarian", "no-preference"]).optional(),
  notes: z.string().max(500).optional(),
  contactFamily: z.string().optional(),
});

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rsvps = await listRsvps();
  return NextResponse.json({ rsvps });
}

export async function POST(request: Request) {
  const parsed = rsvpSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid RSVP details" }, { status: 400 });
  }

  const rsvp = await addRsvp({
    name: parsed.data.name.trim(),
    guests: parsed.data.guests,
    attendance: parsed.data.attendance,
    meal: parsed.data.meal,
    notes: parsed.data.notes?.trim() || undefined,
    contactFamily: parsed.data.contactFamily?.trim() || undefined,
  });

  return NextResponse.json({ rsvp }, { status: 201 });
}
