import { randomUUID } from "crypto";
import { wedding } from "@/data/wedding";
import type { ContentStore, ManagedEvent } from "@/lib/types";

/** Resolve eventId or create a named album from guest input */
export function resolveGuestEvent(
  store: ContentStore,
  input: { eventId?: string; newEventName?: string },
): { store: ContentStore; eventId: string; created?: ManagedEvent } {
  const eventId = input.eventId?.trim() || "";
  const newName = input.newEventName?.trim() || "";

  if (eventId) {
    const existing = store.events.find((item) => item.id === eventId);
    if (!existing) {
      throw new Error("Selected event was not found");
    }
    return { store, eventId };
  }

  if (!newName) {
    return { store, eventId: "" };
  }

  const match = store.events.find(
    (item) => item.name.toLowerCase() === newName.toLowerCase(),
  );
  if (match) {
    return { store, eventId: match.id };
  }

  const template = wedding.events[0];
  const created: ManagedEvent = {
    id: `event-${randomUUID().slice(0, 8)}`,
    name: newName,
    date: template?.date || "12th August 2026",
    day: template?.day || "",
    time: "TBD",
    venue: template?.venue || "Maple Garden",
    venueDetail: template?.venueDetail || "A Unit of Sukhmani Resort",
    address: template?.address || "Buria Road, Jagadhri",
    description: `Guest album · ${newName}`,
    icon: "sparkles",
  };

  return {
    store: { ...store, events: [...store.events, created] },
    eventId: created.id,
    created,
  };
}
