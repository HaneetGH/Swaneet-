#!/usr/bin/env node
/**
 * Live smoke checks against production (no auth flows).
 * Run: node scripts/smoke-production.mjs
 */
const BASE = process.env.SMOKE_BASE_URL || "https://swaneet.vercel.app";

async function check(name, fn) {
  try {
    const result = await fn();
    return { name, ...result };
  } catch (error) {
    return {
      name,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  const results = [];

  results.push(
    await check("GET / returns 200", async () => {
      const res = await fetch(BASE, { redirect: "follow" });
      return { ok: res.ok, detail: `status ${res.status}` };
    }),
  );

  results.push(
    await check("GET /gallery returns 200", async () => {
      const res = await fetch(`${BASE}/gallery`);
      return { ok: res.ok, detail: `status ${res.status}` };
    }),
  );

  results.push(
    await check("GET /dashboard returns 200", async () => {
      const res = await fetch(`${BASE}/dashboard`);
      return { ok: res.ok, detail: `status ${res.status}` };
    }),
  );

  results.push(
    await check("Mehfil invite page loads", async () => {
      const res = await fetch(`${BASE}/i/swnt-chugh-mehfil-k7m2`);
      const html = await res.text();
      const hasTitle = /Swarandeep|Swaneet|Mehfil|celebrations/i.test(html);
      return {
        ok: res.ok && hasTitle,
        detail: `status ${res.status}, has content=${hasTitle}`,
      };
    }),
  );

  results.push(
    await check("Laavan invite page loads", async () => {
      const res = await fetch(`${BASE}/i/swnt-chugh-laavan-p9x4`);
      const html = await res.text();
      const hasTitle = /Swarandeep|Swaneet|wedding|Laavan/i.test(html);
      return {
        ok: res.ok && hasTitle,
        detail: `status ${res.status}, has content=${hasTitle}`,
      };
    }),
  );

  results.push(
    await check("Unknown invite slug 404s", async () => {
      const res = await fetch(`${BASE}/i/not-a-real-slug-xyz`);
      const html = await res.text();
      const soft404 = /not be found|404/i.test(html);
      return {
        ok: res.status === 404 || soft404,
        detail: `status ${res.status}, soft404=${soft404}`,
      };
    }),
  );

  results.push(
    await check("GET /api/events returns events", async () => {
      const res = await fetch(`${BASE}/api/events`);
      const data = await res.json();
      return {
        ok: res.ok && Array.isArray(data.events) && data.events.length > 0,
        detail: `status ${res.status}, count=${data.events?.length ?? 0}`,
      };
    }),
  );

  results.push(
    await check("GET /api/feature-flags returns all sites", async () => {
      const res = await fetch(`${BASE}/api/feature-flags`);
      const data = await res.json();
      const flags = data.flags;
      const ok =
        res.ok &&
        flags?.main?.accommodation !== undefined &&
        flags?.mehfil?.rsvp !== undefined &&
        flags?.laavan?.gallery !== undefined;
      return {
        ok,
        detail: `status ${res.status}, main.accommodation=${flags?.main?.accommodation}`,
      };
    }),
  );

  results.push(
    await check("GET /api/gallery requires auth", async () => {
      const res = await fetch(`${BASE}/api/gallery`);
      return {
        ok: res.status === 401,
        detail: `status ${res.status} (expected 401)`,
      };
    }),
  );

  results.push(
    await check("GET /api/gallery/file requires auth", async () => {
      const res = await fetch(`${BASE}/api/gallery/file/not-a-real-id`);
      return {
        ok: res.status === 401,
        detail: `status ${res.status} (expected 401)`,
      };
    }),
  );

  results.push(
    await check("GET /api/rsvp/me requires Google auth", async () => {
      const res = await fetch(`${BASE}/api/rsvp/me?site=main`);
      return {
        ok: res.status === 401,
        detail: `status ${res.status} (expected 401)`,
      };
    }),
  );

  results.push(
    await check("PUT /api/feature-flags requires master", async () => {
      const res = await fetch(`${BASE}/api/feature-flags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      return {
        ok: res.status === 401 || res.status === 403,
        detail: `status ${res.status} (expected 401/403)`,
      };
    }),
  );

  results.push(
    await check("POST /api/rsvp requires Google auth", async () => {
      const res = await fetch(`${BASE}/api/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Test",
          guests: 1,
          attendance: "yes",
          needsAccommodation: false,
        }),
      });
      return {
        ok: res.status === 401,
        detail: `status ${res.status} (expected 401)`,
      };
    }),
  );

  results.push(
    await check("POST /api/auth/email/send requires Google auth", async () => {
      const res = await fetch(`${BASE}/api/auth/email/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "test@example.com" }),
      });
      return {
        ok: res.status === 401,
        detail: `status ${res.status} (expected 401)`,
      };
    }),
  );

  results.push(
    await check("POST /api/gallery/guest requires Google auth", async () => {
      const res = await fetch(`${BASE}/api/gallery/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: "x", media: [] }),
      });
      return {
        ok: res.status === 401,
        detail: `status ${res.status} (expected 401)`,
      };
    }),
  );

  const failed = results.filter((r) => !r.ok);
  for (const r of results) {
    console.log(
      `${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? ` — ${r.detail}` : ""}`,
    );
  }
  console.log(
    `\n${results.length - failed.length}/${results.length} passed` +
      (failed.length ? ` · ${failed.length} failed` : ""),
  );
  process.exit(failed.length ? 1 : 0);
}

main();
