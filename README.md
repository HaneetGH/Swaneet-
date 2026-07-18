# #Swaneet — Wedding Invitation

A premium, cinematic wedding microsite for **Haneet Singh & Swarandeep Kaur**.

## Stack

- Next.js 15 · React · TypeScript · Tailwind CSS
- Framer Motion · GSAP · Lenis
- React Three Fiber · canvas-confetti
- Vercel Blob (images) · Neon Postgres (events / RSVPs / gallery metadata)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Locally (without cloud env vars), data is stored in:

| Content | Storage |
| --- | --- |
| Events, RSVPs, gallery metadata | `data/content.json` |
| Uploaded images | `public/uploads/` |

## Dashboard

Manage RSVPs, events, and gallery images at `/dashboard`.

Default PIN: `swaneet10`  
Override with `ADMIN_PIN` in `.env.local`.

## Deploy on Vercel

1. Push this repo to GitHub (already at `HaneetGH/Swaneet-`).
2. Import the project in [Vercel](https://vercel.com/new).
3. In the Vercel project, add storage:
   - **Blob** → create store → connect to project (sets `BLOB_READ_WRITE_TOKEN`)
   - **Neon / Postgres** → create database → connect to project (sets `DATABASE_URL` or `POSTGRES_URL`)
4. Set environment variable:
   - `ADMIN_PIN` = your private dashboard PIN
5. Deploy.

On Vercel, the app automatically uses:

- **Neon Postgres** for events, RSVPs, and gallery metadata
- **Vercel Blob** for uploaded images

No code changes needed between local and production — it switches based on env vars.

### Env vars

Copy `.env.example` to `.env.local` for local cloud testing:

```bash
ADMIN_PIN=swaneet10
DATABASE_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
```

## Customize

| Content | File |
| --- | --- |
| Names, venue, family, RSVP defaults | `src/data/wedding.ts` |
| Theme colors | `src/app/globals.css` |
| Invitation art | `public/images/invitation.png` |
| Background music (optional) | `public/audio/wedding-ambient.mp3` |

Music is muted by default. Add an MP3 at the path above to enable the toggle.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — ESLint
