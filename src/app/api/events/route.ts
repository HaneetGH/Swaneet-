import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { listEvents, readStore, writeStore } from "@/lib/store";
import type { ManagedEvent } from "@/lib/types";

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

export async function GET() {
  try {
    const events = await listEvents();
    return NextResponse.json({ events });
  } catch (error) {
    console.error("GET /api/events failed", error);
    return NextResponse.json(
      { error: "Could not load events" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = eventSchema.safeParse(await request.json());
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message || "Invalid event details";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const store = await readStore();
    const event: ManagedEvent = {
      id: `event-${Date.now()}`,
      ...parsed.data,
    };
    store.events.push(event);
    await writeStore(store);
    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("POST /api/events failed", error);
    const message =
      error instanceof Error ? error.message : "Could not save event";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
