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
3. **Required for dashboard edits:** In the Vercel project → **Storage**, connect:
   - **Neon / Postgres** → sets `DATABASE_URL` / `POSTGRES_URL` (events, RSVPs, gallery metadata)
   - **Blob** → sets `BLOB_READ_WRITE_TOKEN` (**required for photos/videos** — uploads go direct to Blob, bypassing the 4.5MB serverless limit)
4. Set environment variables:
   - `ADMIN_PIN` = your private dashboard PIN
   - Firebase web config (`NEXT_PUBLIC_FIREBASE_*`) + `FIREBASE_PROJECT_ID` for accommodation login
5. In Firebase Console → Authentication, enable **Google** and **Phone**.
6. Add your Vercel domain under Authentication → Settings → Authorized domains.
7. Redeploy after connecting storage / Firebase.
8. Optional email for stay confirmations: create a [Resend](https://resend.com) API key, set `RESEND_API_KEY` + `EMAIL_FROM`, then use **Save & email guest** in Dashboard → Stay.

Wedding data (events, RSVPs, gallery, stays) lives in Neon / Blob — **deploys never wipe it**. Seed defaults only run when the database is empty.

Without storage on Vercel, the filesystem is read-only and event create/edit/delete will fail.

On Vercel, the app automatically uses:

- **Neon Postgres** (if connected) for events, RSVPs, gallery metadata, PIN
- **Vercel Blob** for uploaded images (and content backup if no database)
- Local `data/content.json` only in local development

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
