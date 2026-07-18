# #Swaneet — Wedding Invitation

A premium, cinematic wedding microsite for **Haneet Singh & Swarandeep Kaur**.

## Stack

- Next.js 15 · React · TypeScript · Tailwind CSS
- Framer Motion · GSAP · Lenis
- React Three Fiber · canvas-confetti

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Dashboard

Manage events and gallery images at [/dashboard](http://localhost:3002/dashboard).

Default PIN: `swaneet2026`  
Override with `ADMIN_PIN` in `.env.local`.

| Content | Storage |
| --- | --- |
| Events & gallery metadata | `data/content.json` |
| Uploaded images | `public/uploads/` |

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
