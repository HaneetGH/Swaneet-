import { promises as fs } from "fs";
import path from "path";
import { readStoreFromBlob, writeStoreToBlob } from "@/lib/blob-store";
import { readStoreFromDb, writeStoreToDb } from "@/lib/db";
import {
  canPersistData,
  hasBlobStorage,
  hasDatabase,
  isVercelRuntime,
  storageMode,
} from "@/lib/env";
import type {
  ContentStore,
  GalleryImage,
  ManagedEvent,
  RsvpEntry,
} from "@/lib/types";
import { wedding } from "@/data/wedding";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "content.json");

const STORAGE_ERROR =
  "Storage is not configured for this deployment. In Vercel → Project → Storage, connect Neon Postgres (DATABASE_URL) or Blob (BLOB_READ_WRITE_TOKEN), then redeploy.";

export function defaultStore(): ContentStore {
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
    gallery: [],
    rsvps: [],
  };
}

function normalizeStore(raw: Partial<ContentStore>): ContentStore {
  const defaults = defaultStore();
  return {
    events: raw.events ?? defaults.events,
    gallery: raw.gallery ?? defaults.gallery,
    rsvps: raw.rsvps ?? [],
    adminPinHash: raw.adminPinHash,
  };
}

export async function updateAdminPinHash(adminPinHash: string) {
  const store = await readStore();
  store.adminPinHash = adminPinHash;
  await writeStore(store);
}

async function ensureLocalStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(STORE_PATH, JSON.stringify(defaultStore(), null, 2), "utf8");
  }
}

async function readLocalStore(): Promise<ContentStore> {
  await ensureLocalStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  return normalizeStore(JSON.parse(raw) as Partial<ContentStore>);
}

async function writeLocalStore(store: ContentStore): Promise<void> {
  try {
    await ensureLocalStore();
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "EROFS" || err?.code === "EACCES" || isVercelRuntime()) {
      throw new Error(STORAGE_ERROR);
    }
    throw error;
  }
}

export async function readStore(): Promise<ContentStore> {
  const mode = storageMode();

  if (mode === "database") {
    const fromDb = await readStoreFromDb();
    if (!fromDb) {
      const seeded = defaultStore();
      await writeStoreToDb(seeded);
      return seeded;
    }
    return normalizeStore(fromDb);
  }

  if (mode === "blob") {
    const fromBlob = await readStoreFromBlob();
    if (!fromBlob) {
      const seeded = defaultStore();
      await writeStoreToBlob(seeded);
      return seeded;
    }
    return normalizeStore(fromBlob);
  }

  if (mode === "local") {
    return readLocalStore();
  }

  // Vercel without storage: serve defaults read-only
  return defaultStore();
}

export async function writeStore(store: ContentStore): Promise<void> {
  if (!canPersistData()) {
    throw new Error(STORAGE_ERROR);
  }

  const normalized = normalizeStore(store);
  const mode = storageMode();

  if (mode === "database") {
    await writeStoreToDb(normalized);
    return;
  }

  if (mode === "blob") {
    await writeStoreToBlob(normalized);
    return;
  }

  await writeLocalStore(normalized);
}

export function getStorageInfo() {
  return {
    mode: storageMode(),
    hasDatabase: hasDatabase(),
    hasBlobStorage: hasBlobStorage(),
    canPersist: canPersistData(),
    isVercel: isVercelRuntime(),
  };
}

export async function listEvents(): Promise<ManagedEvent[]> {
  const store = await readStore();
  return store.events;
}

export async function listGallery(): Promise<GalleryImage[]> {
  const store = await readStore();
  return store.gallery;
}

export async function listRsvps(): Promise<RsvpEntry[]> {
  const store = await readStore();
  return store.rsvps;
}

export async function addRsvp(
  entry: Omit<RsvpEntry, "id" | "createdAt">,
): Promise<RsvpEntry> {
  const store = await readStore();
  const rsvp: RsvpEntry = {
    ...entry,
    id: `rsvp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  store.rsvps = [rsvp, ...store.rsvps];
  await writeStore(store);
  return rsvp;
}

export async function deleteRsvp(id: string): Promise<boolean> {
  const store = await readStore();
  const next = store.rsvps.filter((item) => item.id !== id);
  if (next.length === store.rsvps.length) return false;
  store.rsvps = next;
  await writeStore(store);
  return true;
}
