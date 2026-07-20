import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { sendAccommodationEmail } from "@/lib/email";
import {
  deleteAccommodation,
  getRoomInventory,
  updateAccommodation,
} from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  status: z.enum(["pending", "confirmed", "declined"]),
  hotelName: z.string().trim().optional().default(""),
  hotelAddress: z.string().trim().optional().default(""),
  roomDetails: z.string().trim().optional().default(""),
  adminNotes: z.string().trim().optional().default(""),
  email: z.string().trim().email().optional().or(z.literal("")),
  sendEmail: z.boolean().optional().default(false),
  /** Rooms to assign from the pool when confirming (defaults to guest request) */
  roomsAssigned: z.coerce.number().int().min(1).max(30).optional(),
});

export async function PUT(request: Request, { params }: Params) {
  try {
    if (!(await requirePermission("stay"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid details" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const updated = await updateAccommodation(id, {
      status: parsed.data.status,
      hotelName: parsed.data.hotelName || undefined,
      hotelAddress: parsed.data.hotelAddress || undefined,
      roomDetails: parsed.data.roomDetails || undefined,
      adminNotes: parsed.data.adminNotes || undefined,
      email: parsed.data.email || undefined,
      roomsAssigned: parsed.data.roomsAssigned,
      confirmedAt:
        parsed.data.status === "confirmed" || parsed.data.status === "declined"
          ? now
          : undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const inventory = await getRoomInventory();

    let emailResult: { sent: boolean; error?: string } = { sent: false };
    if (parsed.data.sendEmail) {
      const result = await sendAccommodationEmail(updated);
      if (result.ok) {
        const withEmail = await updateAccommodation(id, { emailSentAt: now });
        emailResult = { sent: true };
        return NextResponse.json({
          accommodation: withEmail || updated,
          inventory,
          email: emailResult,
        });
      }
      emailResult = { sent: false, error: result.error };
    }

    return NextResponse.json({
      accommodation: updated,
      inventory,
      email: emailResult,
    });
  } catch (error) {
    console.error("PUT /api/accommodation failed", error);
    const message =
      error instanceof Error ? error.message : "Could not update request";
    const status = message.includes("Not enough rooms") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await requirePermission("stay"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await deleteAccommodation(id);
  if (!ok) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }
  const inventory = await getRoomInventory();
  return NextResponse.json({ ok: true, inventory });
}
