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

Locally (without `DATABASE_URL`), invitation defaults come from `src/data/wedding.ts`.
With Neon connected, **all wedding content lives in Postgres** — not in a repo JSON file.

| Content | Storage |
| --- | --- |
| Events, gallery metadata, team, room pool | Neon `content_store` |
| RSVPs & stay requests | Neon `rsvps` / `accommodations` tables |
| Email status | Neon `email_logs` |
| Uploaded images/videos | Vercel Blob |

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
5. In Firebase Console → Authentication, enable **Google**.
6. Add your Vercel domain under Authentication → Settings → Authorized domains.
7. Redeploy after connecting storage / Firebase.
8. Email (stay confirms, team invites, photo OTP): set `RESEND_API_KEY` (Resend domain `mail.technorapper.com` → From `noreply@mail.technorapper.com`). Optional override: `EMAIL_FROM="Swaneet Wedding <noreply@mail.technorapper.com>"`.

Wedding data (events, RSVPs, gallery, stays) lives in **Neon Postgres** — **deploys never wipe it**. Seed defaults only run when the database is empty.

Without `DATABASE_URL` on Vercel, the dashboard cannot save.

On Vercel, the app automatically uses:

- **Neon Postgres** for events, RSVPs, stays, gallery metadata, team, PIN
- **Vercel Blob** for uploaded images/videos
- Invitation defaults from `src/data/wedding.ts` only to seed an empty database

No `data/content.json` in production — that file is local-dev only and ignored by git.

### Env vars

Copy `.env.example` to `.env.local` for local cloud testing:

```bash
ADMIN_PIN=swaneet10
DATABASE_URL=postgresql://...
BLOB_READ_WRITE_TOKEN=vercel_blob_...
RESEND_API_KEY=re_...
EMAIL_FROM="Swaneet Wedding <noreply@mail.technorapper.com>"
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
