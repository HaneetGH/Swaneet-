import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl, hasDatabase } from "@/lib/env";
import type {
  AccommodationRequest,
  ContentStore,
  EmailLogEntry,
  GuestMessage,
  RsvpEntry,
} from "@/lib/types";

let ensured = false;
let ensurePromise: Promise<void> | null = null;
let guestDataMigrated = false;

function sql() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL / POSTGRES_URL is not configured");
  }
  return neon(url);
}

/** Concurrent CREATE TABLE IF NOT EXISTS can race on pg_type in Postgres/Neon. */
function isSchemaRaceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("pg_type_typname_nsp_index") ||
    message.includes("already exists") ||
    /duplicate key value violates unique constraint/i.test(message)
  );
}

function asRows<T extends Record<string, unknown>>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] })?.rows ?? []) as T[];
}

function parseJsonb<T>(raw: unknown): T {
  if (typeof raw === "string") return JSON.parse(raw) as T;
  return raw as T;
}

async function runSchemaEnsure() {
  const db = sql();
  const statements = [
    `
      CREATE TABLE IF NOT EXISTS content_store (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS email_logs (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE INDEX IF NOT EXISTS email_logs_created_at_idx
      ON email_logs (created_at DESC)
    `,
    `
      CREATE TABLE IF NOT EXISTS accommodations (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE INDEX IF NOT EXISTS accommodations_created_at_idx
      ON accommodations (created_at DESC)
    `,
    `
      CREATE TABLE IF NOT EXISTS rsvps (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE INDEX IF NOT EXISTS rsvps_created_at_idx
      ON rsvps (created_at DESC)
    `,
    `
      CREATE TABLE IF NOT EXISTS face_profiles (
        uid TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS face_image_index (
        image_id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS face_people (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS face_detections (
        face_id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS face_merge_logs (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS face_photo_requests (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE TABLE IF NOT EXISTS guest_messages (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `,
    `
      CREATE INDEX IF NOT EXISTS guest_messages_created_at_idx
      ON guest_messages (created_at DESC)
    `,
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      for (const statement of statements) {
        await db.query(statement);
      }
      return;
    } catch (error) {
      if (!isSchemaRaceError(error) || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 80 * (attempt + 1)));
    }
  }
}

export async function ensureDatabase() {
  if (!hasDatabase() || ensured) return;
  if (!ensurePromise) {
    ensurePromise = runSchemaEnsure()
      .then(() => {
        ensured = true;
      })
      .catch((error) => {
        ensurePromise = null;
        throw error;
      });
  }
  await ensurePromise;
}

/**
 * One-time: move stays/RSVPs out of the shared JSON blob into their own tables
 * so concurrent gallery/event writes cannot wipe them, and deploys never touch them.
 */
async function migrateGuestRowsFromContentStore() {
  if (guestDataMigrated) return;
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM content_store WHERE id = $1 LIMIT 1`,
    ["main"],
  );
  const rows = asRows<{ data: unknown }>(result);
  if (!rows.length) {
    guestDataMigrated = true;
    return;
  }

  const store = parseJsonb<ContentStore>(rows[0].data);
  const stays = Array.isArray(store.accommodations) ? store.accommodations : [];
  const rsvps = Array.isArray(store.rsvps) ? store.rsvps : [];

  if (!stays.length && !rsvps.length) {
    guestDataMigrated = true;
    return;
  }

  for (const stay of stays) {
    if (!stay?.id) continue;
    await db.query(
      `
        INSERT INTO accommodations (id, data, created_at)
        VALUES ($1, $2::jsonb, $3::timestamptz)
        ON CONFLICT (id) DO NOTHING
      `,
      [stay.id, JSON.stringify(stay), stay.createdAt || new Date().toISOString()],
    );
  }

  for (const rsvp of rsvps) {
    if (!rsvp?.id) continue;
    await db.query(
      `
        INSERT INTO rsvps (id, data, created_at)
        VALUES ($1, $2::jsonb, $3::timestamptz)
        ON CONFLICT (id) DO NOTHING
      `,
      [rsvp.id, JSON.stringify(rsvp), rsvp.createdAt || new Date().toISOString()],
    );
  }

  const next: ContentStore = {
    ...store,
    accommodations: [],
    rsvps: [],
    emailLogs: [],
  };
  await db.query(
    `
      UPDATE content_store
      SET data = $2::jsonb, updated_at = NOW()
      WHERE id = $1
    `,
    ["main", JSON.stringify(next)],
  );
  guestDataMigrated = true;
}

export async function readStoreFromDb(): Promise<ContentStore | null> {
  await ensureDatabase();
  await migrateGuestRowsFromContentStore();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM content_store WHERE id = $1 LIMIT 1`,
    ["main"],
  );
  const rows = asRows<{ data: unknown }>(result);
  if (!rows.length) return null;

  const store = parseJsonb<ContentStore>(rows[0].data);
  const [accommodations, rsvps] = await Promise.all([
    listAccommodationsFromDb(),
    listRsvpsFromDb(),
  ]);
  return {
    ...store,
    accommodations,
    rsvps,
    emailLogs: [],
  };
}

/** Seed defaults only if no row exists — never overwrite existing wedding data. */
export async function seedStoreIfEmpty(store: ContentStore): Promise<boolean> {
  await ensureDatabase();
  const db = sql();
  const { emailLogs: _e, accommodations: _a, rsvps: _r, ...rest } = store;
  const payload = JSON.stringify({
    ...rest,
    accommodations: [],
    rsvps: [],
    emailLogs: [],
  });
  const result = await db.query(
    `
      INSERT INTO content_store (id, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `,
    ["main", payload],
  );
  return asRows(result).length > 0;
}

export async function writeStoreToDb(store: ContentStore): Promise<void> {
  await ensureDatabase();
  const db = sql();
  // Guest stays/RSVPs/email logs live in their own tables — never embed them
  // in content_store, or concurrent writes will wipe them on deploy races.
  const {
    emailLogs: _emailLogs,
    accommodations: _accommodations,
    rsvps: _rsvps,
    ...rest
  } = store;
  const payload = JSON.stringify({
    ...rest,
    accommodations: [],
    rsvps: [],
    emailLogs: [],
  });

  await db.query(
    `
      INSERT INTO content_store (id, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW()
    `,
    ["main", payload],
  );
}

export async function insertEmailLogToDb(
  entry: EmailLogEntry,
): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(
    `
      INSERT INTO email_logs (id, kind, recipient, subject, status, error, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      entry.id,
      entry.kind,
      entry.to,
      entry.subject,
      entry.status,
      entry.error ?? null,
      entry.createdAt,
    ],
  );
  await db.query(`
    DELETE FROM email_logs
    WHERE id IN (
      SELECT id FROM email_logs
      ORDER BY created_at DESC
      OFFSET 150
    )
  `);
}

export async function listEmailLogsFromDb(): Promise<EmailLogEntry[]> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `
      SELECT id, kind, recipient, subject, status, error, created_at
      FROM email_logs
      ORDER BY created_at DESC
      LIMIT 150
    `,
  );
  const rows = asRows<Record<string, unknown>>(result);

  return rows.map((row) => ({
    id: String(row.id),
    kind: row.kind as EmailLogEntry["kind"],
    to: String(row.recipient),
    subject: String(row.subject),
    status: row.status as EmailLogEntry["status"],
    error: row.error ? String(row.error) : undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  }));
}

export async function listAccommodationsFromDb(): Promise<
  AccommodationRequest[]
> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `
      SELECT data FROM accommodations
      ORDER BY created_at DESC
    `,
  );
  return asRows<{ data: unknown }>(result).map((row) =>
    parseJsonb<AccommodationRequest>(row.data),
  );
}

export async function upsertAccommodationToDb(
  entry: AccommodationRequest,
): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(
    `
      INSERT INTO accommodations (id, data, created_at)
      VALUES ($1, $2::jsonb, $3::timestamptz)
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data
    `,
    [
      entry.id,
      JSON.stringify(entry),
      entry.createdAt || new Date().toISOString(),
    ],
  );
}

export async function deleteAccommodationFromDb(id: string): Promise<boolean> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `DELETE FROM accommodations WHERE id = $1 RETURNING id`,
    [id],
  );
  return asRows(result).length > 0;
}

export async function listRsvpsFromDb(): Promise<RsvpEntry[]> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `
      SELECT data FROM rsvps
      ORDER BY created_at DESC
    `,
  );
  return asRows<{ data: unknown }>(result).map((row) =>
    parseJsonb<RsvpEntry>(row.data),
  );
}

export async function upsertRsvpToDb(entry: RsvpEntry): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(
    `
      INSERT INTO rsvps (id, data, created_at)
      VALUES ($1, $2::jsonb, $3::timestamptz)
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data
    `,
    [
      entry.id,
      JSON.stringify(entry),
      entry.createdAt || new Date().toISOString(),
    ],
  );
}

export async function deleteRsvpFromDb(id: string): Promise<boolean> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `DELETE FROM rsvps WHERE id = $1 RETURNING id`,
    [id],
  );
  return asRows(result).length > 0;
}

export async function listGuestMessagesFromDb(): Promise<GuestMessage[]> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `
      SELECT data FROM guest_messages
      ORDER BY created_at DESC
    `,
  );
  return asRows<{ data: unknown }>(result).map((row) =>
    parseJsonb<GuestMessage>(row.data),
  );
}

export async function upsertGuestMessageToDb(
  entry: GuestMessage,
): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(
    `
      INSERT INTO guest_messages (id, data, created_at)
      VALUES ($1, $2::jsonb, $3::timestamptz)
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data
    `,
    [
      entry.id,
      JSON.stringify(entry),
      entry.createdAt || new Date().toISOString(),
    ],
  );
}

/** Idempotent insert for seeded sample wishes — never overwrite edited rows. */
export async function insertGuestMessageIfAbsent(
  entry: GuestMessage,
): Promise<boolean> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `
      INSERT INTO guest_messages (id, data, created_at)
      VALUES ($1, $2::jsonb, $3::timestamptz)
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `,
    [
      entry.id,
      JSON.stringify(entry),
      entry.createdAt || new Date().toISOString(),
    ],
  );
  return asRows(result).length > 0;
}

export async function deleteGuestMessageFromDb(id: string): Promise<boolean> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `DELETE FROM guest_messages WHERE id = $1 RETURNING id`,
    [id],
  );
  return asRows(result).length > 0;
}

export async function getFaceProfileFromDb(
  uid: string,
): Promise<import("@/lib/types").GuestFaceProfile | null> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM face_profiles WHERE uid = $1 LIMIT 1`,
    [uid],
  );
  const row = asRows<{ data: unknown }>(result)[0];
  return row ? parseJsonb(row.data) : null;
}

export async function upsertFaceProfileToDb(
  profile: import("@/lib/types").GuestFaceProfile,
): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(
    `
      INSERT INTO face_profiles (uid, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (uid)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `,
    [profile.uid, JSON.stringify(profile)],
  );
}

export async function getFaceImageIndexFromDb(
  imageId: string,
): Promise<import("@/lib/types").GalleryFaceIndexEntry | null> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM face_image_index WHERE image_id = $1 LIMIT 1`,
    [imageId],
  );
  const row = asRows<{ data: unknown }>(result)[0];
  return row ? parseJsonb(row.data) : null;
}

export async function listFaceImageIndexFromDb(): Promise<
  import("@/lib/types").GalleryFaceIndexEntry[]
> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM face_image_index ORDER BY updated_at DESC`,
  );
  return asRows<{ data: unknown }>(result).map((row) => parseJsonb(row.data));
}

export async function upsertFaceImageIndexToDb(
  entry: import("@/lib/types").GalleryFaceIndexEntry,
): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(
    `
      INSERT INTO face_image_index (image_id, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (image_id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `,
    [entry.imageId, JSON.stringify(entry)],
  );
}

export async function listFacePeopleFromDb(): Promise<
  import("@/lib/types").FacePerson[]
> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM face_people ORDER BY updated_at DESC`,
  );
  return asRows<{ data: unknown }>(result).map((row) => parseJsonb(row.data));
}

export async function getFacePersonFromDb(
  id: string,
): Promise<import("@/lib/types").FacePerson | null> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM face_people WHERE id = $1 LIMIT 1`,
    [id],
  );
  const row = asRows<{ data: unknown }>(result)[0];
  return row ? parseJsonb(row.data) : null;
}

export async function upsertFacePersonToDb(
  person: import("@/lib/types").FacePerson,
): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(
    `
      INSERT INTO face_people (id, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `,
    [person.id, JSON.stringify(person)],
  );
}

export async function deleteFacePersonFromDb(id: string): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(`DELETE FROM face_people WHERE id = $1`, [id]);
}

export async function listFaceDetectionsFromDb(): Promise<
  import("@/lib/types").FaceDetection[]
> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(`SELECT data FROM face_detections`);
  return asRows<{ data: unknown }>(result).map((row) => parseJsonb(row.data));
}

export async function getFaceDetectionFromDb(
  faceId: string,
): Promise<import("@/lib/types").FaceDetection | null> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM face_detections WHERE face_id = $1 LIMIT 1`,
    [faceId],
  );
  const row = asRows<{ data: unknown }>(result)[0];
  return row ? parseJsonb(row.data) : null;
}

export async function upsertFaceDetectionToDb(
  detection: import("@/lib/types").FaceDetection,
): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(
    `
      INSERT INTO face_detections (face_id, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (face_id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `,
    [detection.faceId, JSON.stringify(detection)],
  );
}

export async function insertFaceMergeLogToDb(
  log: import("@/lib/types").FaceMergeLog,
): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(
    `
      INSERT INTO face_merge_logs (id, data, created_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data
    `,
    [log.id, JSON.stringify(log)],
  );
}

export async function listFaceMergeLogsFromDb(
  limit = 20,
): Promise<import("@/lib/types").FaceMergeLog[]> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM face_merge_logs ORDER BY created_at DESC LIMIT $1`,
    [limit],
  );
  return asRows<{ data: unknown }>(result).map((row) => parseJsonb(row.data));
}

export async function deleteFaceMergeLogFromDb(id: string): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(`DELETE FROM face_merge_logs WHERE id = $1`, [id]);
}

export async function listFacePhotoRequestsFromDb(): Promise<
  import("@/lib/types").FacePhotoRequest[]
> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM face_photo_requests ORDER BY updated_at DESC`,
  );
  return asRows<{ data: unknown }>(result).map((row) => parseJsonb(row.data));
}

export async function getFacePhotoRequestFromDb(
  id: string,
): Promise<import("@/lib/types").FacePhotoRequest | null> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM face_photo_requests WHERE id = $1 LIMIT 1`,
    [id],
  );
  const row = asRows<{ data: unknown }>(result)[0];
  return row ? parseJsonb(row.data) : null;
}

export async function upsertFacePhotoRequestToDb(
  request: import("@/lib/types").FacePhotoRequest,
): Promise<void> {
  await ensureDatabase();
  const db = sql();
  await db.query(
    `
      INSERT INTO face_photo_requests (id, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id)
      DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `,
    [request.id, JSON.stringify(request)],
  );
}
