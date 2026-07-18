import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { listEvents, readStore, writeStore } from "@/lib/store";
import type { ManagedEvent } from "@/lib/types";

const eventSchema = z.object({
  name: z.string().min(2),
  date: z.string().min(2),
  day: z.string().optional().default(""),
  time: z.string().min(1),
  venue: z.string().min(1),
  venueDetail: z.string().optional().default(""),
  address: z.string().optional().default(""),
  description: z.string().optional().default(""),
  icon: z.enum(["moon", "heart", "sun", "star", "sparkles"]).default("heart"),
});

export async function GET() {
  const events = await listEvents();
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = eventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const store = await readStore();
  const event: ManagedEvent = {
    id: `event-${Date.now()}`,
    ...parsed.data,
  };
  store.events.push(event);
  await writeStore(store);
  return NextResponse.json({ event }, { status: 201 });
}
