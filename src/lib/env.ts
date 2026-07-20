export function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.NEON_DATABASE_URL ||
    ""
  );
}

export function hasDatabase() {
  return Boolean(getDatabaseUrl());
}

export function hasBlobStorage() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

export function canPersistData() {
  // Production must use Neon so stays/RSVPs/events survive deploys.
  // Blob alone is only for media files, not the wedding content store.
  if (isVercelRuntime()) return hasDatabase();
  return true;
}

export function storageMode(): "database" | "blob" | "local" | "none" {
  // Neon is the source of truth for wedding content whenever DATABASE_URL is set.
  if (hasDatabase()) return "database";
  if (!isVercelRuntime()) return "local";
  return "none";
}
