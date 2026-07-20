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
  GuestLogin,
  ManagedEvent,
  RsvpEntry,
} from "@/lib/types";
import { sortEventsByDateTime } from "@/lib/datetime";
import { wedding } from "@/data/wedding";
import { hashPin } from "@/lib/pin";
import { memberUsername, normalizePermissions } from "@/lib/roles";
import type { VerifiedGuest } from "@/lib/firebase/admin";

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(DATA_DIR, "content.json");

const STORAGE_ERROR =
  "Storage is not configured for this deployment. In Vercel → Project → Storage, connect Neon Postgres (DATABASE_URL), then redeploy. Stays, RSVPs, and events must live in the database so deploys never wipe them.";

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
    emailOtps: {},
    admins: [],
    guestLogins: [],
    emailLogs: [],
  };
}

const MAX_EMAIL_LOGS = 150;

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
        done: typeof event.done === "boolean" ? event.done : undefined,
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
  }));

  const admins = (raw.admins ?? []).map((admin) => ({
    ...admin,
    permissions: Array.isArray(admin.permissions) ? admin.permissions : [],
    active: admin.active !== false,
    email: admin.email || undefined,
  }));

  const guestLogins = (raw.guestLogins ?? []).map((login) => ({
    ...login,
    sources: Array.isArray(login.sources) ? login.sources : [],
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
        // Only insert if empty — never overwrite Roka/custom data on deploy
        await seedStoreIfEmpty(defaultStore());
        fromDb = await readStoreFromDb();
      }
      if (!fromDb) return defaultStore();
      return normalizeStore(fromDb);
    }

    if (mode === "blob") {
      const fromBlob = await readStoreFromBlob();
      if (!fromBlob) {
        // Blob put with allowOverwrite is used elsewhere; seed only when missing
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
      return readLocalStore();
    }

    // Vercel without storage: serve defaults read-only
    return defaultStore();
  } catch (error) {
    console.error("readStore failed", error);
    // Prefer serving invitation defaults over crashing the page
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
  if (hasDatabase()) {
    const existing = (await listAccommodationsFromDb()).find(
      (item) => item.id === id,
    );
    if (!existing) return null;
    const updated: AccommodationRequest = {
      ...existing,
      ...patch,
      id,
    };
    await upsertAccommodationToDb(updated);
    return updated;
  }

  const store = await readStore();
  const index = store.accommodations.findIndex((item) => item.id === id);
  if (index === -1) return null;

  store.accommodations[index] = {
    ...store.accommodations[index],
    ...patch,
    id,
  };
  await writeStore(store);
  return store.accommodations[index];
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

export async function listGuestLogins(): Promise<GuestLogin[]> {
  const store = await readStore();
  return [...(store.guestLogins || [])].sort(
    (a, b) =>
      new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
  );
}

export async function recordGuestLogin(
  guest: VerifiedGuest,
  source: "stay" | "photos" | "rsvp",
): Promise<void> {
  const store = await readStore();
  const now = new Date().toISOString();
  const list = [...(store.guestLogins || [])];
  const index = list.findIndex((item) => item.uid === guest.uid);
  if (index >= 0) {
    const current = list[index];
    const sources = current.sources.includes(source)
      ? current.sources
      : [...current.sources, source];
    list[index] = {
      ...current,
      email: guest.email || current.email,
      name: guest.name || current.name,
      phone: guest.phone || current.phone,
      lastSeenAt: now,
      sources,
    };
  } else {
    list.push({
      uid: guest.uid,
      email: guest.email,
      name: guest.name,
      phone: guest.phone,
      firstSeenAt: now,
      lastSeenAt: now,
      sources: [source],
    });
  }
  store.guestLogins = list;
  await writeStore(store);
}
