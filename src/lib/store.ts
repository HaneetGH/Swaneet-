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
  FeatureFlags,
  FeatureSite,
  GalleryImage,
  GuestActivityAction,
  GuestLogin,
  GuestProfile,
  ManagedEvent,
  RoomInventory,
  RsvpEntry,
  StayHotel,
} from "@/lib/types";
import {
  collectDownloadedMedia,
  galleryImageIdFromDetail,
  mergeDownloadedMedia,
} from "@/lib/guest-downloads";
import { sortEventsByDateTime } from "@/lib/datetime";
import { normalizeFeatureFlags } from "@/lib/feature-flags";
import {
  deriveOverallAttendance,
  isBrideFeatureSite,
  inviteSitesShareRsvp,
  mergeDayResponses,
  resolveEntryInviteSite,
} from "@/lib/rsvp-days";
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
    featureFlags: undefined,
    emailOtps: {},
    admins: [],
    guestLogins: [],
    faceProfiles: [],
    faceImageIndex: [],
    facePeople: [],
    faceDetections: [],
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
    featureFlags: normalizeFeatureFlags(raw.featureFlags),
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

export async function getFeatureFlags(): Promise<FeatureFlags> {
  const store = await readStore();
  return normalizeFeatureFlags(store.featureFlags);
}

export async function updateFeatureFlags(
  flags: FeatureFlags,
): Promise<FeatureFlags> {
  const store = await readStore();
  const next = normalizeFeatureFlags(flags);
  store.featureFlags = next;
  await writeStore(store);
  return next;
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

export async function getGalleryImageById(
  id: string,
): Promise<GalleryImage | null> {
  const store = await readStore();
  return store.gallery.find((image) => image.id === id) || null;
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
  inviteSite: FeatureSite = "main",
): Promise<RsvpEntry | null> {
  const rsvps = await listRsvps();
  const matches = rsvps.filter((item) => {
    if (!matchesGuest(item, uid, email)) return false;
    const site = resolveEntryInviteSite(item);
    return inviteSitesShareRsvp(site, inviteSite);
  });
  if (!matches.length) return null;
  // Prefer the record with the most day answers (shared bride RSVP), then newest
  return [...matches].sort((a, b) => {
    const days = (b.dayResponses?.length || 0) - (a.dayResponses?.length || 0);
    if (days !== 0) return days;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  })[0];
}

export async function findAccommodationByGuest(
  uid: string,
  email?: string,
  inviteSite: FeatureSite = "main",
): Promise<AccommodationRequest | null> {
  const stays = await listAccommodations();
  const matches = stays.filter((item) => {
    if (!matchesGuest(item, uid, email)) return false;
    const site = resolveEntryInviteSite(item);
    return inviteSitesShareRsvp(site, inviteSite);
  });
  if (!matches.length) return null;
  return [...matches].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
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

/** Create or update RSVP — main is separate; mehfil↔laavan share one bride RSVP. */
export async function upsertRsvpForGuest(
  guest: { uid: string; email: string },
  entry: Omit<RsvpEntry, "id" | "createdAt" | "authUid" | "authEmail" | "email">,
): Promise<{ rsvp: RsvpEntry; updated: boolean }> {
  const inviteSite: FeatureSite =
    entry.inviteSite ||
    (entry.inviteTier === "mehfil" || entry.inviteTier === "laavan"
      ? entry.inviteTier
      : "main");
  const existing = await findRsvpByGuest(guest.uid, guest.email, inviteSite);

  const dayResponses = isBrideFeatureSite(inviteSite)
    ? mergeDayResponses(existing?.dayResponses, entry.dayResponses)
    : entry.dayResponses;

  const attendance = dayResponses?.length
    ? deriveOverallAttendance(dayResponses)
    : entry.attendance;

  // Prefer mehfil label if the shared record already covers mehfil days
  const keepMehfilLabel =
    isBrideFeatureSite(inviteSite) &&
    (existing?.inviteTier === "mehfil" ||
      resolveEntryInviteSite(existing || {}) === "mehfil") &&
    inviteSite === "laavan";

  const payload = {
    ...entry,
    inviteSite: keepMehfilLabel ? ("mehfil" as const) : inviteSite,
    inviteTier: keepMehfilLabel
      ? ("mehfil" as const)
      : entry.inviteTier ||
        (inviteSite === "mehfil" || inviteSite === "laavan"
          ? inviteSite
          : undefined),
    inviteSlug: keepMehfilLabel
      ? existing?.inviteSlug || entry.inviteSlug
      : entry.inviteSlug,
    inviteSide:
      entry.inviteSide ||
      (isBrideFeatureSite(inviteSite) ? ("bride" as const) : undefined),
    dayResponses,
    attendance,
    email: guest.email,
    authUid: guest.uid,
    authEmail: guest.email,
  };

  if (existing) {
    // Collapse duplicate bride RSVPs from the earlier per-site model
    if (isBrideFeatureSite(inviteSite)) {
      const all = await listRsvps();
      const dupes = all.filter(
        (item) =>
          item.id !== existing.id &&
          matchesGuest(item, guest.uid, guest.email) &&
          isBrideFeatureSite(resolveEntryInviteSite(item)),
      );
      for (const dupe of dupes) {
        payload.dayResponses = mergeDayResponses(
          payload.dayResponses,
          dupe.dayResponses,
        );
        await deleteRsvp(dupe.id);
      }
      if (dupes.length) {
        payload.attendance = deriveOverallAttendance(
          payload.dayResponses || [],
        );
      }
    }

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
  const countedGroups = new Set<string>();

  const hotelRows = hotels.map((hotel) => {
    const assigned = accommodations.reduce((sum, item) => {
      if (item.status !== "confirmed") return sum;
      if (typeof item.roomsAssigned !== "number" || item.roomsAssigned <= 0) {
        return sum;
      }
      // Shared room: only the primary's roomsAssigned counts once
      if (item.roomGroupId) {
        if (item.roomGroupRole === "member") return sum;
        if (countedGroups.has(item.roomGroupId)) return sum;
        countedGroups.add(item.roomGroupId);
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

/**
 * Put multiple stay requests in one shared physical room.
 * - Any combination of requests (e.g. 1+1+1 people, or 2+1, etc.)
 * - You decide capacity yourself — we do not store people-per-room limits
 * - Never deletes any request
 * - Rejects anyone who already has roomsAssigned > 0 (their assignment stays)
 * - Deducts exactly 1 inventory room via the primary member
 *
 * Production (Neon): updates ONLY the selected accommodation rows via
 * upsertAccommodationToDb — does not rewrite content_store guest lists
 * and never touches data/content.json.
 */
export async function mergeStaysIntoSharedRoom(input: {
  ids: string[];
  hotelId: string;
  roomDetails?: string;
  adminNotes?: string;
}): Promise<{
  stays: AccommodationRequest[];
  inventory: RoomInventory;
  roomGroupId: string;
}> {
  // On Vercel, refuse Neon — never fall back to local file (would not see prod data)
  if (isVercelRuntime() && !hasDatabase()) {
    throw new Error(
      "Database is not connected. Shared-room assign needs Neon so guest stays are not lost.",
    );
  }

  const uniqueIds = [...new Set(input.ids.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length < 2) {
    throw new Error("Select at least 2 stay requests to share one room.");
  }
  if (uniqueIds.length > 10) {
    throw new Error("Select at most 10 stay requests for one shared room.");
  }

  const hotelId = input.hotelId.trim();
  if (!hotelId) throw new Error("Select a hotel for the shared room.");

  const all = await listAccommodations();
  const selected = uniqueIds.map((id) => {
    const row = all.find((item) => item.id === id);
    if (!row) throw new Error(`Stay request not found: ${id}`);
    return row;
  });

  for (const row of selected) {
    if (row.status === "declined") {
      throw new Error(
        `${row.name}'s request is declined — leave them out of the merge.`,
      );
    }
    if (typeof row.roomsAssigned === "number" && row.roomsAssigned > 0) {
      throw new Error(
        `${row.name} already has ${row.roomsAssigned} room(s) assigned. Do not merge people who already have a room — their assignment is kept as-is.`,
      );
    }
    if (row.roomGroupId) {
      throw new Error(
        `${row.name} is already in a shared room. Leave them out or undo that share first.`,
      );
    }
  }

  const inventory = await getRoomInventory();
  const hotelRow = inventory.hotels.find((hotel) => hotel.id === hotelId);
  if (!hotelRow) {
    throw new Error("Selected hotel was not found. Add the hotel first.");
  }
  if (hotelRow.available < 1) {
    throw new Error(
      `No rooms left at ${hotelRow.name}. Available: ${hotelRow.available}.`,
    );
  }

  const store = await readStore();
  const hotel = (store.hotels || []).find((item) => item.id === hotelId);
  if (!hotel) throw new Error("Selected hotel was not found.");

  // Primary = most people requested, then earliest request
  const ordered = [...selected].sort((a, b) => {
    if (b.people !== a.people) return b.people - a.people;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const primary = ordered[0]!;
  const shareNames = ordered.map((item) => item.name);
  const roomGroupId = `roomgrp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const shareNote = `Sharing 1 room with: ${shareNames.join(", ")}`;
  const roomDetails =
    input.roomDetails?.trim() ||
    `Shared room for ${shareNames.join(", ")}`;
  const adminNotes = [input.adminNotes?.trim(), shareNote]
    .filter(Boolean)
    .join(" · ");

  // Spread each existing row so guest-submitted fields are never dropped
  const nextRows: AccommodationRequest[] = ordered.map((row) => {
    const isPrimary = row.id === primary.id;
    return {
      ...row,
      status: "confirmed" as const,
      hotelId,
      hotelName: hotel.name,
      hotelAddress: hotel.address || row.hotelAddress,
      roomDetails,
      adminNotes: [row.adminNotes, adminNotes].filter(Boolean).join(" · "),
      roomGroupId,
      roomGroupRole: isPrimary ? ("primary" as const) : ("member" as const),
      roomShareWith: shareNames.filter((name) => name !== row.name),
      // Only primary holds the inventory room — members keep request, 0 rooms
      roomsAssigned: isPrimary ? 1 : 0,
      confirmedAt: now,
    };
  });

  if (hasDatabase()) {
    // Prod path: row-level upsert only — other stays / RSVPs untouched
    for (const row of nextRows) {
      await upsertAccommodationToDb(row);
    }
  } else {
    // Local-dev fallback only (no DATABASE_URL)
    const nextStore = await readStore();
    for (const row of nextRows) {
      const index = nextStore.accommodations.findIndex((item) => item.id === row.id);
      if (index === -1) throw new Error(`Stay request not found: ${row.id}`);
      nextStore.accommodations[index] = row;
    }
    await writeStore(nextStore);
  }

  return {
    stays: nextRows,
    inventory: await getRoomInventory(),
    roomGroupId,
  };
}

/** Create or update stay — main separate; mehfil↔laavan share one bride stay. */
export async function upsertAccommodationForGuest(
  guest: { uid: string; email?: string; phone?: string },
  entry: Omit<
    AccommodationRequest,
    "id" | "createdAt" | "authUid" | "authEmail" | "authPhone"
  > & { status?: AccommodationRequest["status"] },
): Promise<{ accommodation: AccommodationRequest; updated: boolean }> {
  const inviteSite: FeatureSite =
    entry.inviteSite ||
    (entry.inviteTier === "mehfil" || entry.inviteTier === "laavan"
      ? entry.inviteTier
      : "main");
  const existing = await findAccommodationByGuest(
    guest.uid,
    guest.email,
    inviteSite,
  );
  const email = entry.email || guest.email || "";

  const keepMehfilLabel =
    isBrideFeatureSite(inviteSite) &&
    (existing?.inviteTier === "mehfil" ||
      resolveEntryInviteSite(existing || {}) === "mehfil") &&
    inviteSite === "laavan";

  const resolvedSite = keepMehfilLabel ? ("mehfil" as const) : inviteSite;
  const resolvedTier = keepMehfilLabel
    ? ("mehfil" as const)
    : entry.inviteTier ||
      (inviteSite === "mehfil" || inviteSite === "laavan" ? inviteSite : undefined);

  if (existing) {
    if (isBrideFeatureSite(inviteSite)) {
      const all = await listAccommodations();
      const dupes = all.filter(
        (item) =>
          item.id !== existing.id &&
          matchesGuest(item, guest.uid, guest.email) &&
          isBrideFeatureSite(resolveEntryInviteSite(item)),
      );
      for (const dupe of dupes) {
        // Never delete a stay that already has a room or is confirmed
        if (dupe.status === "confirmed" || dupe.status === "declined") continue;
        if (typeof dupe.roomsAssigned === "number" && dupe.roomsAssigned > 0) {
          continue;
        }
        if (dupe.roomGroupId) continue;
        await deleteAccommodation(dupe.id);
      }
    }

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
      inviteSide:
        entry.inviteSide ||
        existing.inviteSide ||
        (isBrideFeatureSite(inviteSite) ? "bride" : undefined),
      inviteTier: resolvedTier ?? existing.inviteTier,
      inviteSlug: keepMehfilLabel
        ? existing.inviteSlug || entry.inviteSlug
        : entry.inviteSlug ?? existing.inviteSlug,
      inviteSite: resolvedSite,
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
    inviteSite: resolvedSite,
    inviteTier: resolvedTier,
    inviteSide:
      entry.inviteSide ||
      (isBrideFeatureSite(inviteSite) ? "bride" : undefined),
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
    const matchedRsvps = rsvps.filter(
      (item) =>
        item.authUid === guest.uid ||
        (guest.email &&
          emailKey(item.authEmail || item.email) === emailKey(guest.email)),
    );
    const matchedStays = stays.filter(
      (item) =>
        item.authUid === guest.uid ||
        (guest.email &&
          emailKey(item.authEmail || item.email) === emailKey(guest.email)),
    );
    const rsvp = matchedRsvps[0] || null;
    const stay = matchedStays[0] || null;
    const photoUploads = store.gallery.filter(
      (image) =>
        image.source === "guest" &&
        (image.uploadedByUid === guest.uid ||
          (guest.email &&
            emailKey(image.uploadedByEmail) === emailKey(guest.email))),
    ).length;

    const inviteFromActivity = (guest.activity || [])
      .map((item) => item.detail)
      .find((detail) => detail?.startsWith("invite:"));
    const slugFromActivity = inviteFromActivity
      ?.replace(/^invite:/, "")
      .split("|")[0];
    const inviteTier =
      rsvp?.inviteTier ||
      stay?.inviteTier ||
      guest.inviteTier ||
      (slugFromActivity?.includes("mehfil")
        ? ("mehfil" as const)
        : slugFromActivity?.includes("laavan")
          ? ("laavan" as const)
          : undefined);
    const inviteSlug =
      rsvp?.inviteSlug ||
      stay?.inviteSlug ||
      guest.inviteSlug ||
      slugFromActivity;
    const inviteSide =
      rsvp?.inviteSide ||
      stay?.inviteSide ||
      guest.inviteSide ||
      (inviteTier ? ("bride" as const) : undefined);

    const mapRsvp = (item: (typeof matchedRsvps)[number]) => ({
      id: item.id,
      name: item.name,
      guests: item.guests,
      attendance: item.attendance,
      createdAt: item.createdAt,
      inviteSide: item.inviteSide,
      inviteTier: item.inviteTier,
      inviteSlug: item.inviteSlug,
      inviteSite: item.inviteSite,
    });
    const mapStay = (item: (typeof matchedStays)[number]) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      people: item.people,
      rooms: item.rooms,
      createdAt: item.createdAt,
      inviteSide: item.inviteSide,
      inviteTier: item.inviteTier,
      inviteSlug: item.inviteSlug,
      inviteSite: item.inviteSite,
    });

    const downloads = collectDownloadedMedia(guest);
    const galleryById = new Map(
      store.gallery.map((image) => [image.id, image] as const),
    );
    const downloadedImages = downloads
      .map((item) => {
        const image = galleryById.get(item.imageId);
        if (!image) return null;
        return {
          id: image.id,
          // Dashboard uses session cookie — never expose raw Blob URLs in the UI
          src: `/api/gallery/file/${encodeURIComponent(image.id)}`,
          alt: image.alt,
          kind: image.kind,
          at: item.at,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      src: string;
      alt: string;
      kind: (typeof store.gallery)[number]["kind"];
      at: string;
    }>;

    return {
      ...guest,
      rsvp: rsvp ? mapRsvp(rsvp) : null,
      rsvps: matchedRsvps.map(mapRsvp),
      stay: stay ? mapStay(stay) : null,
      stays: matchedStays.map(mapStay),
      photoUploads,
      downloadedImages,
      inviteSide,
      inviteTier,
      inviteSlug,
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

  let downloadedMedia = current.downloadedMedia || [];
  if (source === "gallery_download") {
    const imageId = galleryImageIdFromDetail(detail);
    if (imageId) {
      downloadedMedia = mergeDownloadedMedia(downloadedMedia, imageId, now);
    }
  }

  let inviteSlug = current.inviteSlug;
  let inviteTier = current.inviteTier;
  let inviteSide = current.inviteSide;
  if (detail?.startsWith("invite:")) {
    const raw = detail.slice("invite:".length);
    inviteSlug = raw.split("|")[0] || inviteSlug;
    inviteSide = "bride";
    if (inviteSlug?.includes("mehfil")) inviteTier = "mehfil";
    else if (inviteSlug?.includes("laavan")) inviteTier = "laavan";
  }

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
    downloadedMedia,
    inviteSlug,
    inviteTier,
    inviteSide,
  };

  if (index >= 0) list[index] = next;
  else list.push(next);

  store.guestLogins = list;
  await writeStore(store);
}
