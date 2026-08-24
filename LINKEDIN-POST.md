# LinkedIn Post — Swaneet Journey

---

**I built a full wedding platform for my own wedding. No client. No startup. Just my problem, my solution.**

Indian weddings = guest lists on paper, hotel rooms in Excel, photos in 10 WhatsApp groups, RSVPs over phone calls.

I'm an engineer. I thought: why am I doing this manually?

So I built one link that handles everything:

🎟️ Cinematic 3D invite (not a PDF)
✅ RSVP per ceremony day — no follow-up calls
🏨 Hotel booking — guests request rooms, I assign from a pool, confirmations go out automatically
📸 AI photo finder — guests take a selfie, AI finds their photos from 500+ images
💬 Wishes wall — guests leave blessings, I approve, they appear live
📊 Family dashboard — RSVPs, rooms, photos, wishes — all in one place

**Every problem had a tool:**

- Cinematic invite → React Three Fiber · GSAP · Framer Motion
- Auth (no passwords) → Firebase (Google one-tap)
- RSVP + hotel + wishes → Neon Postgres
- Photo/video uploads → Vercel Blob
- Face search → AWS Rekognition
- Email confirmations → Resend
- Traffic spikes on wedding day → Feature flags (toggle features on/off live, no redeploy)
- Two ceremonies, one codebase → Next.js 15 multi-site architecture

Hosted on Vercel. Scales to zero when the wedding is over.

**Scaling story:** Wedding day = everyone opens the link at once. Feature flags let me turn off heavy features (gallery, face-find) instantly — kept RSVP + hotel booking fast. Flipped everything back on after. Zero downtime at my own wedding.

I didn't build this for someone else. I was the user. That's why it worked — I knew every pain point.

**It's now a product.** If you're planning a wedding and want to skip the WhatsApp + Excel chaos — or you're a dev who wants to offer this to clients — DM me. Happy to help. 🤝

#BuildInPublic #NextJS #FullStack #AI #WeddingTech #AWSRekognition #ProductEngineering
