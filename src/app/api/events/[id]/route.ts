import { NextResponse } from "next/server";
import { z } from "zod";
import { isAuthenticated } from "@/lib/auth";
import { readStore, writeStore } from "@/lib/store";

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

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = eventSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const store = await readStore();
  const index = store.events.findIndex((event) => event.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  store.events[index] = { id, ...parsed.data };
  await writeStore(store);
  return NextResponse.json({ event: store.events[index] });
}

export async function DELETE(_request: Request, { params }: Params) {
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
}
