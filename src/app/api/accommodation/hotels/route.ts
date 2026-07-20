import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import {
  deleteHotel,
  getRoomInventory,
  listHotels,
  upsertHotel,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const hotelSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Hotel name is required"),
  address: z.string().trim().optional().default(""),
  totalRooms: z.coerce.number().int().min(0).max(500),
  notes: z.string().trim().optional().default(""),
});

export async function GET() {
  if (!(await requirePermission("stay"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [hotels, inventory] = await Promise.all([
    listHotels(),
    getRoomInventory(),
  ]);
  return NextResponse.json({ hotels, inventory });
}

export async function POST(request: Request) {
  try {
    if (!(await requirePermission("stay"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = hotelSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid hotel" },
        { status: 400 },
      );
    }
    const hotel = await upsertHotel({
      name: parsed.data.name,
      address: parsed.data.address || undefined,
      totalRooms: parsed.data.totalRooms,
      notes: parsed.data.notes || undefined,
    });
    const inventory = await getRoomInventory();
    return NextResponse.json({ hotel, inventory }, { status: 201 });
  } catch (error) {
    console.error("POST /api/accommodation/hotels failed", error);
    const message =
      error instanceof Error ? error.message : "Could not save hotel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await requirePermission("stay"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const parsed = hotelSchema.extend({ id: z.string().min(1) }).safeParse(
      await request.json(),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid hotel" },
        { status: 400 },
      );
    }
    const hotel = await upsertHotel({
      id: parsed.data.id,
      name: parsed.data.name,
      address: parsed.data.address || undefined,
      totalRooms: parsed.data.totalRooms,
      notes: parsed.data.notes || undefined,
    });
    const inventory = await getRoomInventory();
    return NextResponse.json({ hotel, inventory });
  } catch (error) {
    console.error("PUT /api/accommodation/hotels failed", error);
    const message =
      error instanceof Error ? error.message : "Could not update hotel";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await requirePermission("stay"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();
    if (!id) {
      return NextResponse.json({ error: "Hotel id is required" }, { status: 400 });
    }
    await deleteHotel(id);
    const inventory = await getRoomInventory();
    return NextResponse.json({ ok: true, inventory });
  } catch (error) {
    console.error("DELETE /api/accommodation/hotels failed", error);
    const message =
      error instanceof Error ? error.message : "Could not delete hotel";
    const status = message.includes("Cannot delete") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
