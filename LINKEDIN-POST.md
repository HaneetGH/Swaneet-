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

**Every problem → a solution → the right tool:**

| Problem I faced | How I solved it | Tech I used |
|---|---|---|
| Boring PDF invites no one opens | Cinematic animated 3D invite | React Three Fiber · GSAP · Framer Motion |
| "Are you coming?" phone calls | Self-serve RSVP per ceremony day | Next.js · Neon Postgres |
| Hotel room chaos in Excel | Guests request rooms, I assign from a pool | Neon Postgres · Resend (confirmations) |
| Guest login without passwords | Google sign-in, one tap | Firebase Auth |
| 500+ wedding photos, guests can't find theirs | Selfie → AI matches their face → download | AWS Rekognition |
| Photo/video uploads hit serverless limits | Direct-to-cloud upload | Vercel Blob |
| Guests want to leave blessings | Wishes wall with moderation | Neon Postgres · Resend (status emails) |
| Wedding day traffic spike | Feature flags — toggle features on/off instantly | Custom per-ceremony flags |
| Two ceremonies, one codebase | Multi-site architecture with shared components | Next.js 15 · TypeScript |
| Need to manage everything in one place | Family dashboard — RSVPs, rooms, photos, wishes | Tailwind CSS · React 19 |

Hosted on **Vercel**. Database on **Neon Postgres**. Emails via **Resend**. All serverless — scales to zero when the wedding is over.

---

**How I scaled it when traffic spiked:**

Wedding day = everyone opens the link at the same time. Feature flags let me toggle heavy features (gallery, uploads, face-find) off instantly — keeping RSVP + hotel booking fast. Once traffic settled, I flipped everything back on. Zero downtime. No panicked hotfix at my own wedding.

---

**The lesson:**

I didn't build this for a client or a startup. I built it for myself — for my own wedding. And that's exactly why it worked. When you're the user, you know every pain point. You don't over-engineer. You just solve.

Best product I've ever shipped — and I was the first customer.

---

**It's now a product.**

What started as my own wedding solution is now something anyone can use. If you're planning a wedding and tired of the WhatsApp + Excel + phone call chaos — or if you're a developer who wants to offer this to clients — let's connect.

DM me. Happy to help. 🤝

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

Every problem had a tool:
- Face search → AWS Rekognition
- Auth → Firebase (Google one-tap)
- Database → Neon Postgres
- Photo uploads → Vercel Blob
- Emails → Resend
- Traffic spikes → Feature flags (toggle features live)

No client brief. No sprint board. Just me solving my own wedding chaos.

**It's now a product.** If you're planning a wedding and want to skip the WhatsApp + Excel mess — DM me. Happy to help. 🤝

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
