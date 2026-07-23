# #Swaneet — Wedding Invitation

A premium, cinematic wedding microsite for **Haneet Singh & Swarandeep Kaur**.

## Stack

- Next.js 15 · React · TypeScript · Tailwind CSS
- Framer Motion · GSAP · Lenis
- React Three Fiber · canvas-confetti
- Vercel Blob (images) · Neon Postgres (events / RSVPs / gallery metadata)
- AWS Rekognition (face find) · Firebase Auth · Resend (email)

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

## Face recognition (Find my photos)

Guests can find wedding photos of themselves with a selfie. Team members with the **Faces** permission manage people clusters and can email photo links to RSVP guests.

### Simple model (A / B / C)

| Piece | Service | Role |
| --- | --- | --- |
| **A — Files** | Vercel Blob | Stores photo + selfie bytes (URLs) |
| **B — Brain** | AWS Rekognition | Detects faces, compares similarity (`IndexFaces` / `SearchFaces` / `SearchFacesByImage`) |
| **C — Memory** | Neon Postgres | People clusters, detections, guest profiles, merge history, photo-request queue |
| **App** | Next.js APIs | Glue: upload → index → assign → merge → email links |

Rekognition does **not** store your wedding album. Neon does **not** run face matching. The app connects them.

### High-level architecture

```mermaid
flowchart TB
  subgraph guests [Guests]
    G1[Upload selfie]
    G2[Download my photos]
  end

  subgraph team [Team / Faces permission]
    T1[Index gallery]
    T2[Merge people]
    T3[Email photo link]
  end

  subgraph app [Next.js App]
    API["/api/face/*"]
  end

  subgraph A [A — Vercel Blob]
    Blob[(Photos + selfies)]
  end

  subgraph B [B — AWS Rekognition]
    Coll[(Face collection)]
  end

  subgraph C [C — Neon Postgres]
    People[(People clusters)]
    Detect[(Detections)]
    Profiles[(Guest profiles)]
    Queue[(Photo requests)]
    Merges[(Merge log)]
  end

  G1 --> API
  G2 --> API
  T1 --> API
  T2 --> API
  T3 --> API
  API --> Blob
  API --> Coll
  API --> People
  API --> Detect
  API --> Profiles
  API --> Queue
  API --> Merges
```

### Guest flow — find & download photos

```mermaid
flowchart TD
  Start([Guest opens Download photos]) --> Selfie[Upload selfie to Blob]
  Selfie --> Search[SearchFacesByImage]
  Search --> Hit{Matches?}
  Hit -->|Yes| List[Show matched photos]
  List --> DL[Download / zip]
  Hit -->|No| Queue[Save request in Neon]
  Queue --> Wait[Wait for more indexing]
  Wait --> Reindex[Team reindexes gallery]
  Reindex --> Notify[Email when photos ready]
  Notify --> Link[Guest opens link]
  Link --> List
```

### Team flow — index, merge, share

```mermaid
flowchart TD
  Upload[Photos in gallery / Blob] --> Index[IndexFaces into Rekognition]
  Index --> Detect[Save FaceDetection rows in Neon]
  Detect --> Assign[Assign FaceId → Person cluster]
  Assign --> Review[Faces dashboard]
  Review --> Merge{Same person split?}
  Merge -->|Yes| Multi[Multi-select merge]
  Multi --> Survivor[Keep largest cluster]
  Survivor --> Reinforce[Absorb similar small clusters]
  Reinforce --> Confirmed[Mark userConfirmed]
  Review --> Email[Pick RSVP guest email]
  Email --> Magic[Send magic link /shared-photos]
  Magic --> GuestSees[Guest sees their photos]
```

### What learns vs what does not

| Action | What changes |
| --- | --- |
| Index gallery | New FaceIds in Rekognition + detections in Neon |
| Merge people | Neon Person buckets + optional reinforce via SearchFaces |
| Guest selfie | Temporary search only (not stored as training by default) |
| Model weights | **Never** — AWS Rekognition model is not retrained by this app |

### Env vars (face find)

| Variable | Purpose |
| --- | --- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | Rekognition credentials |
| `AWS_REGION` | e.g. `ap-south-1` (trim spaces) |
| `AWS_REKOGNITION_COLLECTION_ID` | Face collection name |
| Feature flag `face_find` | Per-site toggle (main / mehfil / laavan) |
| Team permission `faces` | Who can index / merge / email links |

Guest UI: homepage **Download your photos** banner → `/my-photos`.  
Admin UI: Dashboard → **Faces**. Shared links: `/shared-photos?t=…`.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — start production server
- `npm run lint` — ESLint
