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
  await db`
    CREATE TABLE IF NOT EXISTS content_store (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  ensured = true;
}

export async function readStoreFromDb(): Promise<ContentStore | null> {
  await ensureDatabase();
  const db = sql();
  const rows = await db`
    SELECT data FROM content_store WHERE id = 'main' LIMIT 1
  `;
  if (!rows.length) return null;
  return rows[0].data as ContentStore;
}

export async function writeStoreToDb(store: ContentStore): Promise<void> {
  await ensureDatabase();
  const db = sql();
  // neon serializes JS objects to jsonb when the column type is jsonb
  await db`
    INSERT INTO content_store (id, data, updated_at)
    VALUES ('main', ${store as never}, NOW())
    ON CONFLICT (id)
    DO UPDATE SET data = ${store as never}, updated_at = NOW()
  `;
}
