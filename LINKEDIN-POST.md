# LinkedIn Post — Swaneet Journey

---

## Option 1: Impact-focused (recommended)

---

**I built a full product for my own wedding — RSVPs, hotel bookings, AI photo search — all from one link.**

No client. No freelance gig. Just my wedding, my problem, my solution.

Here's the story of #Swaneet 👇

---

**The thought:**

My wedding was coming up. And I saw the same chaos every Indian wedding has — guest lists on paper, hotel rooms tracked in Excel, photos scattered across 10 WhatsApp groups, RSVPs over phone calls.

I'm an engineer. I thought: why am I dealing with this manually? What if I build one link that handles *everything*?

---

**What we built — the major features:**

🎟️ **Digital Invitation** — Not a PDF. A cinematic, animated invite guests actually open and interact with.

✅ **RSVP System** — Guests confirm per ceremony day (Mehfil, Laavan). Family sees attendance in real-time. No follow-up calls needed.

🏨 **Hotel Booking & Room Management** — Guests request rooms with check-in/out dates. Family manages a hotel pool, assigns rooms, confirms/declines — all from a dashboard. Guests get email confirmations. Partial-night offers handled automatically.

📸 **AI Photo Finder** — After the wedding, guests take a selfie → AI finds all their photos from the gallery. No tagging. No scrolling through 500 photos.

💬 **Wishes Wall** — Guests leave blessings. Family approves them. They appear live on the site.

📊 **Family Dashboard** — One place to see: who's coming, who needs a room, how many rooms are left, guest uploads, wishes to approve.

---

**How it actually helped:**

- Guests booked hotel rooms directly through the site — no back-and-forth phone calls
- Family could see room occupancy at a glance and manage inventory across hotels
- RSVPs came in per-day, so catering and seating plans were accurate
- Guests found their own wedding photos with a selfie — no one had to manually tag or share
- Wishes came in before, during, and after the wedding — became a keepsake

---

**The tech stack:**

Next.js 15 · React 19 · TypeScript · Tailwind CSS · Framer Motion · GSAP · React Three Fiber (3D) · Neon Postgres · Vercel Blob · AWS Rekognition · Firebase Auth · Resend (email) · Vercel (hosting)

---

**How I scaled it when traffic spiked:**

Wedding day = everyone opens the link at the same time. I used **feature flags per ceremony** — so I could toggle heavy features (gallery, photo uploads, face-find, wishes) on/off instantly without redeploying.

When guest traffic peaked, I turned off non-essential features to keep the core (invitation + RSVP + hotel booking) fast. Once traffic settled, I flipped everything back on. Zero downtime. No panicked hotfix at my own wedding.

Feature flags also let me run **two ceremony sites** (Mehfil + Laavan) from one codebase — each with its own set of enabled features.

---

**The lesson:**

I didn't build this for a client or a startup. I built it for myself — for my own wedding. And that's exactly why it worked. When you're the user, you know every pain point. You don't over-engineer. You just solve.

Best product I've ever shipped — and I was the first customer.

---

#BuildInPublic #FullStack #NextJS #WeddingTech #ProductEngineering

---

## Option 2: Shorter version

---

**I built a wedding platform for my own wedding — not a client project, not a startup. Just me solving my own problem.**

Not a template. A real product I actually used:

→ Guests RSVP per ceremony day — family sees numbers in real-time
→ Hotel room booking + assignment — guests request, family approves, emails go out
→ AI photo finder — take a selfie, get your wedding photos (no manual tagging)
→ Wishes wall — guests leave blessings, family curates them live
→ One dashboard to manage it all

The result? No Excel sheets. No WhatsApp chaos. Guests booked rooms, confirmed attendance, and found their photos — all from one link.

Stack: Next.js 15 · React 19 · TypeScript · Tailwind · Neon Postgres · Vercel Blob · AWS Rekognition · Firebase Auth · Resend

Scaling trick: feature flags per ceremony. Wedding day traffic spike? Turn off heavy features instantly, keep RSVP + booking fast. Flip them back on when traffic settles. Zero downtime at my own wedding.

No client brief. No sprint board. Just me building for myself — and that's why it worked.

#BuildInPublic #NextJS #WeddingTech #AI

---

## Option 3: Carousel slides

| Slide | Headline | Body |
|-------|----------|------|
| 1 | I built this for MY wedding | No client. No startup. I was the user — and the engineer. |
| 2 | The problem | Guest lists on paper. Rooms tracked in Excel. Photos in 10 WhatsApp groups. |
| 3 | RSVP | Guests confirm per ceremony day. Family sees real-time attendance. No follow-up calls. |
| 4 | Hotel Booking | Guests request rooms with dates. Family assigns from a hotel pool. Confirmation emails auto-sent. |
| 5 | AI Photo Finder | Guest takes a selfie → AI matches their face across the gallery → they download their photos. |
| 6 | Wishes Wall | Guests leave blessings. Family approves. They appear live — a digital guestbook. |
| 7 | The Dashboard | One place: RSVPs, room occupancy, guest uploads, wishes — all managed by family. |
| 8 | The takeaway | I didn't need a client. I was the user. Best product I've ever shipped. |
