import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { readStore, writeStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  name: z.string().trim().min(2, "Event name is required"),
  date: z.string().trim().min(2, "Date is required"),
  day: z.string().optional().default(""),
  time: z.string().trim().min(1, "Time is required"),
  venue: z.string().trim().min(1, "Venue is required"),
  venueDetail: z.string().optional().default(""),
  address: z.string().optional().default(""),
  description: z.string().optional().default(""),
  icon: z.enum(["moon", "heart", "sun", "star", "sparkles"]).default("heart"),
});

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const parsed = eventSchema.safeParse(await request.json());
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message || "Invalid event details";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const store = await readStore();
    const index = store.events.findIndex((event) => event.id === id);
    if (index === -1) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    store.events[index] = { id, ...parsed.data };
    await writeStore(store);
    return NextResponse.json({ event: store.events[index] });
  } catch (error) {
    console.error("PUT /api/events failed", error);
    const message =
      error instanceof Error ? error.message : "Could not save event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const store = await readStore();
    const next = store.events.filter((event) => event.id !== id);
    if (next.length === store.events.length) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    store.events = next;
    await writeStore(store);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/events failed", error);
    const message =
      error instanceof Error ? error.message : "Could not delete event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
