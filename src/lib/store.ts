import { promises as fs } from "fs";
import path from "path";
import type { ContentStore, GalleryImage, ManagedEvent } from "@/lib/types";
import { wedding } from "@/data/wedding";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "content.json");

function defaultStore(): ContentStore {
  return {
    events: wedding.events.map((event) => ({
      id: event.id,
      name: event.name,
      date: event.date,
      day: event.day,
      time: event.time,
      venue: event.venue,
      venueDetail: event.venueDetail,
      address: event.address,
      description: event.description,
      icon: event.icon,
    })),
    gallery: wedding.gallery.map((item) => ({
      id: String(item.id),
      alt: item.alt,
      src: "/images/invitation.png",
      aspect: item.aspect,
      createdAt: new Date(0).toISOString(),
    })),
  };
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(defaultStore(), null, 2), "utf8");
  }
}

export async function readStore(): Promise<ContentStore> {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  return JSON.parse(raw) as ContentStore;
}

export async function writeStore(store: ContentStore): Promise<void> {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

export async function listEvents(): Promise<ManagedEvent[]> {
  const store = await readStore();
  return store.events;
}

export async function saveEvents(events: ManagedEvent[]): Promise<ManagedEvent[]> {
  const store = await readStore();
  store.events = events;
  await writeStore(store);
  return store.events;
}

export async function listGallery(): Promise<GalleryImage[]> {
  const store = await readStore();
  return store.gallery;
}

export async function saveGallery(gallery: GalleryImage[]): Promise<GalleryImage[]> {
  const store = await readStore();
  store.gallery = gallery;
  await writeStore(store);
  return store.gallery;
}
