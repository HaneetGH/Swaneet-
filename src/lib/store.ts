import { promises as fs } from "fs";
import path from "path";
import { readStoreFromBlob, writeStoreToBlob } from "@/lib/blob-store";
import {
  deleteAccommodationFromDb,
  deleteRsvpFromDb,
  insertEmailLogToDb,
  listAccommodationsFromDb,
  listEmailLogsFromDb,
  listRsvpsFromDb,
  readStoreFromDb,
  seedStoreIfEmpty,
  upsertAccommodationToDb,
  upsertRsvpToDb,
  writeStoreToDb,
} from "@/lib/db";
import {
  canPersistData,
  hasBlobStorage,
  hasDatabase,
  isVercelRuntime,
  storageMode,
} from "@/lib/env";
import type {
  AccommodationRequest,
  AdminMember,
  AdminPermission,
  ContentStore,
  EmailKind,
  EmailLogEntry,
  GalleryImage,
  GuestActivityAction,
  GuestLogin,
  GuestProfile,
  ManagedEvent,
  RoomInventory,
  RsvpEntry,
  StayHotel,
} from "@/lib/types";
import { sortEventsByDateTime } from "@/lib/datetime";
import { wedding } from "@/data/wedding";
import { hashPin } from "@/lib/pin";
import type { VerifiedGuest } from "@/lib/firebase/admin";
import { memberUsername, normalizePermissions } from "@/lib/roles";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "content.json");

const STORAGE_ERROR =
  "Neon database is not configured. In Vercel → Storage, connect Neon (DATABASE_URL), then redeploy. Wedding content (events, stays, RSVPs) must live in the database — not data/content.json.";

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
    accommodations: [],
    hotels: [],
    totalRooms: 0,
    rsvpBanner: {},
    emailOtps: {},
    admins: [],
    guestLogins: [],
    emailLogs: [],
  };
}

const MAX_EMAIL_LOGS = 150;

function eventsNeedVenuePersist(
  before: ManagedEvent[] | undefined,
  after: ManagedEvent[],
): boolean {
  if (!before?.length) return false;
  const beforeById = new Map(before.map((event) => [event.id, event]));
  return after.some((event) => {
    const prev = beforeById.get(event.id);
    if (!prev) return false;
    return prev.venue !== event.venue || prev.venueDetail !== event.venueDetail;
  });
}

/** Clear stale `done: false` flags that blocked auto Done on past events. */
function eventsNeedDonePersist(
  before: ManagedEvent[] | undefined,
  after: ManagedEvent[],
): boolean {
  if (!before?.length) return false;
  const beforeById = new Map(before.map((event) => [event.id, event]));
  return after.some((event) => {
    const prev = beforeById.get(event.id);
    return prev?.done === false && event.done !== false;
  });
}

function normalizeStore(raw: Partial<ContentStore>): ContentStore {
  const defaults = defaultStore();
  const hasPersistedShape =
    raw.events != null ||
    raw.gallery != null ||
    raw.rsvps != null ||
    raw.accommodations != null;

  const gallery = (raw.gallery ?? []).map((image) => ({
    ...image,
    eventId: image.eventId || "",
    kind:
      image.kind === "video" ||
      /\.(mp4|webm|mov)(\?|$)/i.test(image.src) ||
      image.src.includes("video/")
        ? ("video" as const)
        : ("image" as const),
    status:
      image.status === "pending" || image.status === "rejected"
        ? image.status
        : ("approved" as const),
    source: image.source === "guest" ? ("guest" as const) : ("admin" as const),
  }));

  // Never replace a saved store's events with invitation defaults
  const events = sortEventsByDateTime(
    (Array.isArray(raw.events)
      ? raw.events
      : hasPersistedShape
        ? []
        : defaults.events
    ).map((event) => {
      const base = {
        ...event,
        // Only persist explicit Done; false was an API default that broke auto-past
        done: event.done === true ? true : undefined,
      };
      // Anand Karaj + Brunch are at the Gurudwara (keep dinner at Maple Garden)
      const isCeremony =
        event.id === "anand-karaj" ||
        event.id === "brunch" ||
        /^anand\s*karaj$/i.test(event.name) ||
        /^brunch$/i.test(event.name);
      if (isCeremony && /maple\s*garden/i.test(event.venue || "")) {
        return {
          ...base,
          venue: "Gurudwara",
          venueDetail: "",
          address: event.address || "Buria Road, Jagadhri",
        };
      }
      return base;
    }),
  );

  const accommodations = (raw.accommodations ?? []).map((item) => ({
    ...item,
    email: item.email || item.authEmail || "",
    status: item.status || ("pending" as const),
    hotelId: item.hotelId || undefined,
    roomsAssigned:
      typeof item.roomsAssigned === "number" ? item.roomsAssigned : undefined,
  }));

  let hotels: StayHotel[] = (raw.hotels ?? [])
    .filter((hotel) => hotel && typeof hotel.id === "string" && hotel.name)
    .map((hotel) => ({
      id: hotel.id,
      name: String(hotel.name).trim(),
      address: hotel.address?.trim() || undefined,
      totalRooms: Math.max(0, Math.floor(Number(hotel.totalRooms) || 0)),
      notes: hotel.notes?.trim() || undefined,
      createdAt: hotel.createdAt || new Date().toISOString(),
    }));

  const legacyTotal =
    typeof raw.totalRooms === "number" && raw.totalRooms >= 0
      ? Math.floor(raw.totalRooms)
      : 0;

  // Migrate old single pool into one hotel so existing totals are not lost
  if (!hotels.length && legacyTotal > 0) {
    hotels = [
      {
        id: "hotel-legacy-pool",
        name: "Family rooms",
        totalRooms: legacyTotal,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  const totalRooms = hotels.reduce((sum, hotel) => sum + hotel.totalRooms, 0);

  const admins = (raw.admins ?? []).map((admin) => ({
    ...admin,
    permissions: Array.isArray(admin.permissions) ? admin.permissions : [],
    active: admin.active !== false,
    email: admin.email || undefined,
  }));

  const guestLogins = (raw.guestLogins ?? []).map((login) => ({
    ...login,
    sources: Array.isArray(login.sources) ? login.sources : [],
    stats: login.stats
      ? {
          galleryViews: Number(login.stats.galleryViews) || 0,
          galleryDownloads: Number(login.stats.galleryDownloads) || 0,
          lastGalleryViewAt: login.stats.lastGalleryViewAt,
          lastGalleryDownloadAt: login.stats.lastGalleryDownloadAt,
          lastLoginAt: login.stats.lastLoginAt,
          lastRsvpAt: login.stats.lastRsvpAt,
          lastStayAt: login.stats.lastStayAt,
          lastPhotoUploadAt: login.stats.lastPhotoUploadAt,
        }
      : undefined,
    activity: Array.isArray(login.activity)
      ? login.activity.slice(0, 40)
      : undefined,
  }));

  const emailLogs = (raw.emailLogs ?? [])
    .filter(
      (entry) =>
        entry &&
        typeof entry.id === "string" &&
        typeof entry.to === "string" &&
        (entry.status === "sent" || entry.status === "failed"),
    )
    .slice(0, MAX_EMAIL_LOGS);

  return {
    events,
    gallery,
    rsvps: raw.rsvps ?? [],
    accommodations,
    hotels,
    totalRooms,
    rsvpBanner: {
      imageUrl: raw.rsvpBanner?.imageUrl?.trim() || undefined,
    },
    emailOtps: raw.emailOtps ?? {},
    admins,
    guestLogins,
    emailLogs,
    adminPinHash: raw.adminPinHash,
  };
}

export async function listEmailLogs(): Promise<EmailLogEntry[]> {
  if (hasDatabase()) {
    try {
      return await listEmailLogsFromDb();
    } catch (error) {
      console.error("listEmailLogsFromDb failed", error);
    }
  }
  const store = await readStore();
  return [...(store.emailLogs || [])];
}

export async function appendEmailLog(input: {
  kind: EmailKind;
  to: string;
  subject: string;
  status: "sent" | "failed";
  error?: string;
}): Promise<EmailLogEntry> {
  const entry: EmailLogEntry = {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    to: input.to.trim().toLowerCase(),
    subject: input.subject,
    status: input.status,
    error: input.error,
    createdAt: new Date().toISOString(),
  };

  if (hasDatabase()) {
    await insertEmailLogToDb(entry);
    return entry;
  }

  const store = await readStore();
  const existing = store.emailLogs || [];
  store.emailLogs = [
    entry,
    ...existing.filter((item) => item.id !== entry.id),
  ].slice(0, MAX_EMAIL_LOGS);
  await writeStore(store);
  return entry;
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

  try {
    if (mode === "database") {
      let fromDb = await readStoreFromDb();
      if (!fromDb) {
        // Only insert if empty — never overwrite wedding data on deploy
        await seedStoreIfEmpty(defaultStore());
        fromDb = await readStoreFromDb();
      }
      if (!fromDb) return defaultStore();

      const normalized = normalizeStore(fromDb);
      // Persist one-time venue fixes (e.g. Gurudwara) into Neon so the DB
      // stays the source of truth — not data/content.json.
      if (
        eventsNeedVenuePersist(fromDb.events, normalized.events) ||
        eventsNeedDonePersist(fromDb.events, normalized.events)
      ) {
        await writeStoreToDb(normalized).catch((error) =>
          console.error("persist event migration failed", error),
        );
      }
      return normalized;
    }

    if (mode === "blob") {
      const fromBlob = await readStoreFromBlob();
      if (!fromBlob) {
        try {
          await writeStoreToBlob(defaultStore());
        } catch {
          // Another request may have created it
        }
        const again = await readStoreFromBlob();
        if (again) return normalizeStore(again);
        return defaultStore();
      }
      return normalizeStore(fromBlob);
    }

    if (mode === "local") {
      // Local-only fallback when DATABASE_URL is missing. Prefer Neon.
      console.warn(
        "[swaneet] Using local data/content.json — set DATABASE_URL so content comes from Neon.",
      );
      return readLocalStore();
    }

    // Vercel without storage: serve defaults read-only
    return defaultStore();
  } catch (error) {
    console.error("readStore failed", error);
    if (mode === "database" || mode === "blob") {
      throw error;
    }
    return defaultStore();
  }
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

export async function getRsvpBanner(): Promise<{ imageUrl?: string }> {
  const store = await readStore();
  return {
    imageUrl: store.rsvpBanner?.imageUrl || undefined,
  };
}

export async function setRsvpBannerImage(
  imageUrl: string | undefined,
): Promise<{ imageUrl?: string }> {
  const store = await readStore();
  store.rsvpBanner = {
    imageUrl: imageUrl?.trim() || undefined,
  };
  await writeStore(store);
  return store.rsvpBanner;
}

export async function listEvents(): Promise<ManagedEvent[]> {
  const store = await readStore();
  return sortEventsByDateTime(store.events);
}

export async function listGallery(options?: {
  includePending?: boolean;
}): Promise<GalleryImage[]> {
  const store = await readStore();
  if (options?.includePending) return store.gallery;
  return store.gallery.filter((image) => image.status === "approved");
}

export async function listRsvps(): Promise<RsvpEntry[]> {
  if (hasDatabase()) {
    return listRsvpsFromDb();
  }
  const store = await readStore();
  return store.rsvps;
}

function matchesGuest(
  entry: { authUid?: string; authEmail?: string; email?: string },
  uid: string,
  email?: string,
) {
  if (entry.authUid && entry.authUid === uid) return true;
  const needle = email?.trim().toLowerCase();
  if (!needle) return false;
  const hay = (entry.authEmail || entry.email || "").trim().toLowerCase();
  return Boolean(hay && hay === needle);
}

export async function findRsvpByGuest(
  uid: string,
  email?: string,
): Promise<RsvpEntry | null> {
  const rsvps = await listRsvps();
  return (
    rsvps.find((item) => matchesGuest(item, uid, email)) ||
    null
  );
}

export async function findAccommodationByGuest(
  uid: string,
  email?: string,
): Promise<AccommodationRequest | null> {
  const stays = await listAccommodations();
  return (
    stays.find((item) => matchesGuest(item, uid, email)) ||
    null
  );
}

export async function addRsvp(
  entry: Omit<RsvpEntry, "id" | "createdAt">,
): Promise<RsvpEntry> {
  const rsvp: RsvpEntry = {
    ...entry,
    id: `rsvp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  if (hasDatabase()) {
    await upsertRsvpToDb(rsvp);
    return rsvp;
  }

  const store = await readStore();
  store.rsvps = [rsvp, ...store.rsvps];
  await writeStore(store);
  return rsvp;
}

export async function updateRsvp(
  id: string,
  patch: Partial<RsvpEntry>,
): Promise<RsvpEntry | null> {
  const existing = (await listRsvps()).find((item) => item.id === id);
  if (!existing) return null;

  const updated: RsvpEntry = {
    ...existing,
    ...patch,
    id,
    createdAt: existing.createdAt,
  };

  if (hasDatabase()) {
    await upsertRsvpToDb(updated);
    return updated;
  }

  const store = await readStore();
  const index = store.rsvps.findIndex((item) => item.id === id);
  if (index === -1) return null;
  store.rsvps[index] = updated;
  await writeStore(store);
  return updated;
}

/** Create or update RSVP for the same Google guest (one RSVP per account). */
export async function upsertRsvpForGuest(
  guest: { uid: string; email: string },
  entry: Omit<RsvpEntry, "id" | "createdAt" | "authUid" | "authEmail" | "email">,
): Promise<{ rsvp: RsvpEntry; updated: boolean }> {
  const existing = await findRsvpByGuest(guest.uid, guest.email);
  const payload = {
    ...entry,
    email: guest.email,
    authUid: guest.uid,
    authEmail: guest.email,
  };

  if (existing) {
    const rsvp = await updateRsvp(existing.id, payload);
    return { rsvp: rsvp!, updated: true };
  }

  const rsvp = await addRsvp(payload);
  return { rsvp, updated: false };
}

export async function deleteRsvp(id: string): Promise<boolean> {
  if (hasDatabase()) {
    return deleteRsvpFromDb(id);
  }
  const store = await readStore();
  const next = store.rsvps.filter((item) => item.id !== id);
  if (next.length === store.rsvps.length) return false;
  store.rsvps = next;
  await writeStore(store);
  return true;
}

export async function listAccommodations(): Promise<AccommodationRequest[]> {
  if (hasDatabase()) {
    return listAccommodationsFromDb();
  }
  const store = await readStore();
  return store.accommodations;
}

export function computeRoomInventory(
  accommodations: AccommodationRequest[],
  hotels: StayHotel[],
): RoomInventory {
  const hotelRows = hotels.map((hotel) => {
    const assigned = accommodations.reduce((sum, item) => {
      if (item.status !== "confirmed") return sum;
      if (typeof item.roomsAssigned !== "number" || item.roomsAssigned <= 0) {
        return sum;
      }
      if (item.hotelId) {
        return item.hotelId === hotel.id ? sum + item.roomsAssigned : sum;
      }
      // Legacy assignments without hotelId count against the only hotel
      if (hotels.length === 1 && hotels[0].id === hotel.id) {
        return sum + item.roomsAssigned;
      }
      return sum;
    }, 0);

    return {
      id: hotel.id,
      name: hotel.name,
      address: hotel.address,
      totalRooms: hotel.totalRooms,
      assigned,
      available: Math.max(0, hotel.totalRooms - assigned),
      notes: hotel.notes,
    };
  });

  const total = hotelRows.reduce((sum, row) => sum + row.totalRooms, 0);
  const assigned = hotelRows.reduce((sum, row) => sum + row.assigned, 0);

  return {
    total,
    assigned,
    available: Math.max(0, total - assigned),
    hotels: hotelRows,
  };
}

export async function getRoomInventory(): Promise<RoomInventory> {
  const store = await readStore();
  const accommodations = hasDatabase()
    ? await listAccommodationsFromDb()
    : store.accommodations;
  return computeRoomInventory(accommodations, store.hotels || []);
}

export async function listHotels(): Promise<StayHotel[]> {
  const store = await readStore();
  return [...(store.hotels || [])];
}

export async function upsertHotel(input: {
  id?: string;
  name: string;
  address?: string;
  totalRooms: number;
  notes?: string;
}): Promise<StayHotel> {
  const store = await readStore();
  const hotels = [...(store.hotels || [])];
  const name = input.name.trim();
  if (!name) throw new Error("Hotel name is required");
  const totalRooms = Math.max(0, Math.floor(input.totalRooms));

  if (input.id) {
    const index = hotels.findIndex((hotel) => hotel.id === input.id);
    if (index === -1) throw new Error("Hotel not found");
    hotels[index] = {
      ...hotels[index],
      name,
      address: input.address?.trim() || undefined,
      totalRooms,
      notes: input.notes?.trim() || undefined,
    };
    store.hotels = hotels;
    store.totalRooms = hotels.reduce((sum, hotel) => sum + hotel.totalRooms, 0);
    await writeStore(store);
    return hotels[index];
  }

  const hotel: StayHotel = {
    id: `hotel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    address: input.address?.trim() || undefined,
    totalRooms,
    notes: input.notes?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
  store.hotels = [hotel, ...hotels];
  store.totalRooms = store.hotels.reduce(
    (sum, item) => sum + item.totalRooms,
    0,
  );
  await writeStore(store);
  return hotel;
}

export async function deleteHotel(id: string): Promise<boolean> {
  const store = await readStore();
  const hotels = store.hotels || [];
  const next = hotels.filter((hotel) => hotel.id !== id);
  if (next.length === hotels.length) return false;

  const accommodations = hasDatabase()
    ? await listAccommodationsFromDb()
    : store.accommodations;
  const stillAssigned = accommodations.some(
    (item) =>
      item.status === "confirmed" &&
      item.hotelId === id &&
      typeof item.roomsAssigned === "number" &&
      item.roomsAssigned > 0,
  );
  if (stillAssigned) {
    throw new Error(
      "Cannot delete this hotel while rooms are still assigned to guests. Reassign or clear those stays first.",
    );
  }

  store.hotels = next;
  store.totalRooms = next.reduce((sum, hotel) => sum + hotel.totalRooms, 0);
  await writeStore(store);
  return true;
}

/** @deprecated Use upsertHotel — kept for older clients setting a single pool */
export async function setTotalRooms(totalRooms: number): Promise<RoomInventory> {
  const store = await readStore();
  const hotels = [...(store.hotels || [])];
  const total = Math.max(0, Math.floor(totalRooms));
  if (!hotels.length) {
    if (total > 0) {
      hotels.push({
        id: "hotel-legacy-pool",
        name: "Family rooms",
        totalRooms: total,
        createdAt: new Date().toISOString(),
      });
    }
  } else if (hotels.length === 1) {
    hotels[0] = { ...hotels[0], totalRooms: total };
  } else {
    throw new Error(
      "You have multiple hotels — edit each hotel’s room count instead of a single total.",
    );
  }
  store.hotels = hotels;
  store.totalRooms = hotels.reduce((sum, hotel) => sum + hotel.totalRooms, 0);
  await writeStore(store);
  const accommodations = hasDatabase()
    ? await listAccommodationsFromDb()
    : store.accommodations;
  return computeRoomInventory(accommodations, store.hotels);
}

export async function addAccommodation(
  entry: Omit<AccommodationRequest, "id" | "createdAt" | "status"> & {
    status?: AccommodationRequest["status"];
  },
): Promise<AccommodationRequest> {
  const request: AccommodationRequest = {
    ...entry,
    status: entry.status || "pending",
    email: entry.email || entry.authEmail || "",
    id: `stay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  if (hasDatabase()) {
    await upsertAccommodationToDb(request);
    return request;
  }

  const store = await readStore();
  store.accommodations = [request, ...store.accommodations];
  await writeStore(store);
  return request;
}

export async function updateAccommodation(
  id: string,
  patch: Partial<AccommodationRequest>,
): Promise<AccommodationRequest | null> {
  const existing = (await listAccommodations()).find((item) => item.id === id);
  if (!existing) return null;

  const nextStatus = patch.status ?? existing.status;
  let roomsAssigned =
    typeof existing.roomsAssigned === "number"
      ? existing.roomsAssigned
      : undefined;
  let hotelId = existing.hotelId;

  // Confirm alone does not auto-assign. Assign only when roomsAssigned is set.
  if (typeof patch.roomsAssigned === "number") {
    if (nextStatus === "confirmed" && patch.roomsAssigned > 0) {
      const nextHotelId =
        typeof patch.hotelId === "string" && patch.hotelId
          ? patch.hotelId
          : existing.hotelId;
      if (!nextHotelId) {
        throw new Error("Select a hotel before assigning rooms.");
      }

      const inventory = await getRoomInventory();
      const hotelRow = inventory.hotels.find((hotel) => hotel.id === nextHotelId);
      if (!hotelRow) {
        throw new Error("Selected hotel was not found. Add the hotel first.");
      }

      const currentlyHolding =
        existing.status === "confirmed" &&
        existing.hotelId === nextHotelId &&
        typeof existing.roomsAssigned === "number"
          ? existing.roomsAssigned
          : 0;
      const availableForThis = hotelRow.available + currentlyHolding;

      if (patch.roomsAssigned > availableForThis) {
        throw new Error(
          `Not enough rooms at ${hotelRow.name}. Available: ${availableForThis}, needed: ${patch.roomsAssigned}.`,
        );
      }

      roomsAssigned = patch.roomsAssigned;
      hotelId = nextHotelId;

      // Prefill hotel name/address from inventory when not provided
      const store = await readStore();
      const hotel = (store.hotels || []).find((item) => item.id === nextHotelId);
      if (hotel) {
        if (!patch.hotelName && !existing.hotelName) {
          patch.hotelName = hotel.name;
        }
        if (!patch.hotelAddress && !existing.hotelAddress && hotel.address) {
          patch.hotelAddress = hotel.address;
        }
      }
    } else {
      roomsAssigned = undefined;
      hotelId = undefined;
    }
  } else if (typeof patch.hotelId === "string") {
    hotelId = patch.hotelId || undefined;
  }

  if (nextStatus === "pending" || nextStatus === "declined") {
    roomsAssigned = undefined;
    hotelId = undefined;
  }

  const updated: AccommodationRequest = {
    ...existing,
    ...patch,
    id,
    status: nextStatus,
    roomsAssigned,
    hotelId,
  };

  if (nextStatus !== "confirmed") {
    updated.roomsAssigned = undefined;
    updated.hotelId = undefined;
  }

  if (hasDatabase()) {
    await upsertAccommodationToDb(updated);
    return updated;
  }

  const store = await readStore();
  const index = store.accommodations.findIndex((item) => item.id === id);
  if (index === -1) return null;
  store.accommodations[index] = updated;
  await writeStore(store);
  return updated;
}

/** Create or update stay for the same Google guest (one stay request per account). */
export async function upsertAccommodationForGuest(
  guest: { uid: string; email?: string; phone?: string },
  entry: Omit<
    AccommodationRequest,
    "id" | "createdAt" | "authUid" | "authEmail" | "authPhone"
  > & { status?: AccommodationRequest["status"] },
): Promise<{ accommodation: AccommodationRequest; updated: boolean }> {
  const existing = await findAccommodationByGuest(guest.uid, guest.email);
  const email = entry.email || guest.email || "";

  if (existing) {
    // Guest edits keep status pending unless family already confirmed/declined —
    // only overwrite guest-owned fields; keep hotel confirmation details.
    const accommodation = await updateAccommodation(existing.id, {
      name: entry.name,
      phone: entry.phone,
      email,
      people: entry.people,
      rooms: entry.rooms,
      checkIn: entry.checkIn,
      checkOut: entry.checkOut,
      notes: entry.notes,
      contactFamily: entry.contactFamily,
      rsvpId: entry.rsvpId ?? existing.rsvpId,
      authUid: guest.uid,
      authEmail: guest.email,
      authPhone: guest.phone,
      inviteSide: entry.inviteSide ?? existing.inviteSide,
      inviteTier: entry.inviteTier ?? existing.inviteTier,
      inviteSlug: entry.inviteSlug ?? existing.inviteSlug,
      // If family already decided, keep that status; otherwise stay pending
      status:
        existing.status === "confirmed" || existing.status === "declined"
          ? existing.status
          : entry.status || "pending",
    });
    return { accommodation: accommodation!, updated: true };
  }

  const accommodation = await addAccommodation({
    ...entry,
    email,
    authUid: guest.uid,
    authEmail: guest.email,
    authPhone: guest.phone,
  });
  return { accommodation, updated: false };
}

export async function deleteAccommodation(id: string): Promise<boolean> {
  if (hasDatabase()) {
    return deleteAccommodationFromDb(id);
  }
  const store = await readStore();
  const next = store.accommodations.filter((item) => item.id !== id);
  if (next.length === store.accommodations.length) return false;
  store.accommodations = next;
  await writeStore(store);
  return true;
}

export async function listAdmins(): Promise<
  Omit<AdminMember, "pinHash">[]
> {
  const store = await readStore();
  return (store.admins || []).map(({ pinHash: _pin, ...rest }) => ({
    ...rest,
    permissions: normalizePermissions(rest.permissions),
  }));
}

export async function createAdmin(input: {
  name: string;
  email: string;
  pin: string;
  permissions: AdminPermission[];
}): Promise<Omit<AdminMember, "pinHash">> {
  const store = await readStore();
  const username = memberUsername(input.name);
  if (!username) {
    throw new Error("Name is required");
  }
  const taken = (store.admins || []).some(
    (admin) =>
      admin.active && memberUsername(admin.name) === username,
  );
  if (taken) {
    throw new Error(
      `Username "${username}" is already used by another team member. Use a different first name.`,
    );
  }

  const member: AdminMember = {
    id: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    pinHash: hashPin(input.pin),
    permissions: normalizePermissions(input.permissions).filter(
      (p) => p !== "team",
    ),
    active: true,
    createdAt: new Date().toISOString(),
  };
  store.admins = [...(store.admins || []), member];
  await writeStore(store);
  const { pinHash: _pin, ...safe } = member;
  return safe;
}

export async function updateAdmin(
  id: string,
  patch: {
    name?: string;
    email?: string;
    pin?: string;
    permissions?: AdminPermission[];
    active?: boolean;
  },
): Promise<Omit<AdminMember, "pinHash"> | null> {
  const store = await readStore();
  const index = (store.admins || []).findIndex((item) => item.id === id);
  if (index < 0) return null;

  const current = store.admins![index];
  const nextName = patch.name?.trim() || current.name;
  const username = memberUsername(nextName);
  if (!username) {
    throw new Error("Name is required");
  }
  const taken = (store.admins || []).some(
    (admin) =>
      admin.id !== id &&
      admin.active &&
      memberUsername(admin.name) === username,
  );
  if (taken) {
    throw new Error(
      `Username "${username}" is already used by another team member. Use a different first name.`,
    );
  }

  const next: AdminMember = {
    ...current,
    name: nextName,
    email:
      patch.email !== undefined
        ? patch.email.trim() || undefined
        : current.email,
    permissions:
      patch.permissions !== undefined
        ? normalizePermissions(patch.permissions).filter((p) => p !== "team")
        : current.permissions,
    active: patch.active !== undefined ? patch.active : current.active,
    pinHash: patch.pin ? hashPin(patch.pin) : current.pinHash,
  };
  store.admins![index] = next;
  await writeStore(store);
  const { pinHash: _pin, ...safe } = next;
  return safe;
}

export async function deleteAdmin(id: string): Promise<boolean> {
  const store = await readStore();
  const next = (store.admins || []).filter((item) => item.id !== id);
  if (next.length === (store.admins || []).length) return false;
  store.admins = next;
  await writeStore(store);
  return true;
}

const MAX_GUEST_ACTIVITY = 40;
const GALLERY_VIEW_DEBOUNCE_MS = 30 * 60 * 1000;

function emptyGuestStats() {
  return {
    galleryViews: 0,
    galleryDownloads: 0,
  };
}

export async function listGuestLogins(): Promise<GuestLogin[]> {
  const store = await readStore();
  return [...(store.guestLogins || [])].sort(
    (a, b) =>
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );
}

/** Guests with linked RSVP, stay request, and photo upload counts. */
export async function listGuestProfiles(): Promise<GuestProfile[]> {
  const [guests, rsvps, stays, store] = await Promise.all([
    listGuestLogins(),
    listRsvps(),
    listAccommodations(),
    readStore(),
  ]);

  const emailKey = (value?: string) => value?.trim().toLowerCase() || "";

  return guests.map((guest) => {
    const rsvp =
      rsvps.find(
        (item) =>
          item.authUid === guest.uid ||
          (guest.email &&
            emailKey(item.authEmail || item.email) === emailKey(guest.email)),
      ) || null;
    const stay =
      stays.find(
        (item) =>
          item.authUid === guest.uid ||
          (guest.email &&
            emailKey(item.authEmail || item.email) === emailKey(guest.email)),
      ) || null;
    const photoUploads = store.gallery.filter(
      (image) =>
        image.source === "guest" &&
        (image.uploadedByUid === guest.uid ||
          (guest.email &&
            emailKey(image.uploadedByEmail) === emailKey(guest.email))),
    ).length;

    return {
      ...guest,
      rsvp: rsvp
        ? {
            id: rsvp.id,
            name: rsvp.name,
            guests: rsvp.guests,
            attendance: rsvp.attendance,
            createdAt: rsvp.createdAt,
          }
        : null,
      stay: stay
        ? {
            id: stay.id,
            name: stay.name,
            status: stay.status,
            people: stay.people,
            rooms: stay.rooms,
            createdAt: stay.createdAt,
          }
        : null,
      photoUploads,
    };
  });
}

export async function recordGuestLogin(
  guest: VerifiedGuest,
  source: GuestActivityAction,
  detail?: string,
): Promise<void> {
  const store = await readStore();
  const now = new Date().toISOString();
  const list = [...(store.guestLogins || [])];
  const index = list.findIndex((item) => item.uid === guest.uid);
  const current: GuestLogin =
    index >= 0
      ? list[index]!
      : {
          uid: guest.uid,
          email: guest.email,
          name: guest.name,
          phone: guest.phone,
          firstSeenAt: now,
          lastSeenAt: now,
          sources: [],
          stats: emptyGuestStats(),
          activity: [],
        };

  const stats = { ...emptyGuestStats(), ...current.stats };

  // Debounce gallery views so refreshes don't inflate counts
  if (source === "gallery_view" && stats.lastGalleryViewAt) {
    const elapsed =
      Date.now() - new Date(stats.lastGalleryViewAt).getTime();
    if (elapsed < GALLERY_VIEW_DEBOUNCE_MS) {
      const updated: GuestLogin = {
        ...current,
        email: guest.email || current.email,
        name: guest.name || current.name,
        phone: guest.phone || current.phone,
        lastSeenAt: now,
        stats,
      };
      if (index >= 0) list[index] = updated;
      else list.push(updated);
      store.guestLogins = list;
      await writeStore(store);
      return;
    }
  }

  if (source === "gallery_view") {
    stats.galleryViews += 1;
    stats.lastGalleryViewAt = now;
  } else if (source === "gallery_download") {
    stats.galleryDownloads += 1;
    stats.lastGalleryDownloadAt = now;
  } else if (source === "login") {
    stats.lastLoginAt = now;
  } else if (source === "rsvp") {
    stats.lastRsvpAt = now;
  } else if (source === "stay") {
    stats.lastStayAt = now;
  } else if (source === "photos") {
    stats.lastPhotoUploadAt = now;
  }

  const sources = current.sources.includes(source)
    ? current.sources
    : [...current.sources, source];

  const activity: GuestLogin["activity"] = [
    { action: source, at: now, detail: detail || undefined },
    ...(current.activity || []),
  ].slice(0, MAX_GUEST_ACTIVITY);

  const next: GuestLogin = {
    ...current,
    email: guest.email || current.email,
    name: guest.name || current.name,
    phone: guest.phone || current.phone,
    lastSeenAt: now,
    firstSeenAt: current.firstSeenAt || now,
    sources,
    stats,
    activity,
  };

  if (index >= 0) list[index] = next;
  else list.push(next);

  store.guestLogins = list;
  await writeStore(store);
}
