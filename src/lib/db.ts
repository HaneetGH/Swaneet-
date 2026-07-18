import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl, hasDatabase } from "@/lib/env";
import type { ContentStore } from "@/lib/types";

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
  ensured = true;
}

export async function readStoreFromDb(): Promise<ContentStore | null> {
  await ensureDatabase();
  const db = sql();
  const rows = await db.query(
    `SELECT data FROM content_store WHERE id = $1 LIMIT 1`,
    ["main"],
  );
  if (!rows.length) return null;

  const raw = rows[0].data;
  if (typeof raw === "string") {
    return JSON.parse(raw) as ContentStore;
  }
  return raw as ContentStore;
}

export async function writeStoreToDb(store: ContentStore): Promise<void> {
  await ensureDatabase();
  const db = sql();
  const payload = JSON.stringify(store);

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
