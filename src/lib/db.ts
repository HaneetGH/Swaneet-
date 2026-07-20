import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl, hasDatabase } from "@/lib/env";
import type { ContentStore, EmailLogEntry } from "@/lib/types";

let ensured = false;

function sql() {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL / POSTGRES_URL is not configured");
  }
  return neon(url);
}

export async function ensureDatabase() {
  if (!hasDatabase() || ensured) return;
  const db = sql();
  await db.query(`
    CREATE TABLE IF NOT EXISTS content_store (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      recipient TEXT NOT NULL,
      subject TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`
    CREATE INDEX IF NOT EXISTS email_logs_created_at_idx
    ON email_logs (created_at DESC)
  `);
  ensured = true;
}

export async function readStoreFromDb(): Promise<ContentStore | null> {
  await ensureDatabase();
  const db = sql();
  const result = await db.query(
    `SELECT data FROM content_store WHERE id = $1 LIMIT 1`,
    ["main"],
  );
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: Array<{ data: unknown }> })?.rows ?? []);
  if (!rows.length) return null;

  const raw = rows[0]?.data;
  if (raw == null) return null;
  if (typeof raw === "string") {
    return JSON.parse(raw) as ContentStore;
  }
  return raw as ContentStore;
}

/** Seed defaults only if no row exists — never overwrite existing wedding data. */
export async function seedStoreIfEmpty(store: ContentStore): Promise<boolean> {
  await ensureDatabase();
  const db = sql();
  const payload = JSON.stringify(store);
  const result = await db.query(
    `
      INSERT INTO content_store (id, data, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `,
    ["main", payload],
  );
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] })?.rows ?? []);
  return rows.length > 0;
}

export async function writeStoreToDb(store: ContentStore): Promise<void> {
  await ensureDatabase();
  const db = sql();
  // Keep wedding content in content_store; email logs live in email_logs table
  // so concurrent RSVP/gallery writes cannot wipe the send history.
  const { emailLogs: _ignored, ...rest } = store;
  const payload = JSON.stringify({ ...rest, emailLogs: [] });

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
  // Keep table bounded
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
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: Array<Record<string, unknown>> })?.rows ?? []);

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
