"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Heart, Quote, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  GuestAuthPanel,
  getGuestIdToken,
} from "@/components/rsvp/GuestAuthPanel";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { buildDisplayWishPool } from "@/data/sample-wishes";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useGuestAuth } from "@/hooks/useGuestAuth";
import { useInvite } from "@/lib/invite-context";
import { cn } from "@/lib/utils";

type PublicWish = {
  id: string;
  body: string;
  displayName: string;
  createdAt: string;
};

const fieldClass =
  "w-full rounded-xl border border-gold/25 bg-[#141018] px-4 py-3 font-body text-sm text-cream outline-none transition placeholder:text-muted/60 focus:border-gold/60 focus:bg-[#1a1520]";

function WishCard({
  wish,
  featured = false,
}: {
  wish: PublicWish;
  featured?: boolean;
}) {
  return (
    <article
      className={cn(
        "relative overflow-hidden border border-gold/20 bg-[#120f16]/80 px-5 py-6",
        featured ? "min-h-[11rem]" : "",
      )}
    >
      <Quote
        size={featured ? 28 : 18}
        className="absolute right-4 top-4 text-gold/25"
      />
      <p
        className={cn(
          "font-display leading-relaxed text-cream",
          featured ? "text-2xl sm:text-3xl" : "text-lg",
        )}
      >
        “{wish.body}”
      </p>
      <p className="mt-4 font-body text-[11px] uppercase tracking-[0.22em] text-gold-soft">
        — {wish.displayName}
      </p>
    </article>
  );
}

export function GuestWishes() {
  const { enabled, ready: flagsReady } = useFeatureFlags();
  const wishesOn = !flagsReady || enabled("guest_messages");
  const { user, ready: authReady } = useGuestAuth();
  const invite = useInvite();

  const [wishes, setWishes] = useState<PublicWish[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [featuredIndex, setFeaturedIndex] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/messages", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        messages?: PublicWish[];
      };
      setWishes(data.messages || []);
    } catch {
      setWishes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!wishesOn) return;
    void load();
  }, [load, wishesOn]);

  useEffect(() => {
    if (user?.displayName && !displayName) {
      setDisplayName(user.displayName);
    }
  }, [displayName, user?.displayName]);

  // DB wishes: real first, samples kept; unique bodies only
  const displayWishes = useMemo(() => buildDisplayWishPool(wishes), [wishes]);

  useEffect(() => {
    if (displayWishes.length <= 1) return;
    const timer = window.setInterval(() => {
      setFeaturedIndex((current) => (current + 1) % displayWishes.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [displayWishes.length]);

  const featured =
    displayWishes[featuredIndex % Math.max(displayWishes.length, 1)] || null;
  const topWishes = displayWishes.slice(0, 3);
  const marqueeItems = useMemo(() => {
    if (displayWishes.length === 0) return [];
    const base =
      displayWishes.length < 4
        ? [...displayWishes, ...displayWishes, ...displayWishes]
        : displayWishes;
    return [...base, ...base];
  }, [displayWishes]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setError("Please sign in with Google first.");
        return;
      }
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body,
          displayName: displayName || undefined,
          inviteTier: invite?.tier,
          inviteSlug: invite?.slug,
          inviteSide: invite ? "bride" : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not share your wish.");
        return;
      }
      setBody("");
      setSuccess(
        "Thank you — your wish is with the family for a quick review before it appears here.",
      );
    } catch {
      setError("Could not share your wish.");
    } finally {
      setBusy(false);
    }
  };

  if (!wishesOn) return null;

  return (
    <section id="wishes" className="section-pad relative overflow-hidden">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-maroon/20 blur-[110px]"
        animate={{ opacity: [0.35, 0.55, 0.35], scale: [1, 1.08, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-gold/10 blur-[100px]"
        animate={{ opacity: [0.25, 0.45, 0.25], y: [0, -12, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <div className="relative mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="From our guests"
          title="Wishes"
          subtitle="Friends and family are already sending blessings — add yours for Haneet and Swarandeep"
        />

        {topWishes.length > 0 ? (
          <div className="mt-10">
            <p className="mb-4 text-center font-body text-[10px] uppercase tracking-[0.28em] text-gold/70">
              Just shared
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              {topWishes.map((wish, index) => (
                <motion.div
                  key={wish.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{
                    duration: 0.55,
                    delay: index * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <WishCard wish={wish} featured={index === 0} />
                </motion.div>
              ))}
            </div>
          </div>
        ) : null}

        {featured && wishes.length > 3 ? (
          <div className="mx-auto mt-10 max-w-3xl">
            <p className="mb-4 text-center font-body text-[10px] uppercase tracking-[0.28em] text-gold/70">
              Spotlight
            </p>
            <AnimatePresence mode="wait">
              <motion.div
                key={featured.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <WishCard wish={featured} featured />
              </motion.div>
            </AnimatePresence>
          </div>
        ) : null}

        {marqueeItems.length > 0 ? (
          <div className="relative mt-10 overflow-hidden">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[var(--bg-deep)] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[var(--bg-deep)] to-transparent" />
            <motion.div
              className="flex w-max gap-4"
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 42, ease: "linear", repeat: Infinity }}
            >
              {marqueeItems.map((wish, index) => (
                <div
                  key={`${wish.id}-${index}`}
                  className="w-[18rem] shrink-0 sm:w-[22rem]"
                >
                  <WishCard wish={wish} />
                </div>
              ))}
            </motion.div>
          </div>
        ) : null}

        {!loading && wishes.length === 0 ? (
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 text-center font-body text-sm text-muted"
          >
            Be the first to leave a wish for the couple.
          </motion.p>
        ) : null}

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-12 max-w-2xl border border-gold/25 bg-[#120f16]/70 px-5 py-6 sm:px-7"
        >
          <div className="flex items-center gap-2 text-gold-soft">
            <Heart size={16} />
            <p className="font-body text-[11px] uppercase tracking-[0.22em]">
              Leave a wish
            </p>
          </div>
          <p className="mt-2 font-body text-sm text-muted">
            Anyone can read the wishes above. To add yours for Haneet and
            Swarandeep, sign in with Google — the family reviews each post before
            it appears on the wall.
          </p>

          {!authReady ? (
            <p className="mt-5 font-body text-sm text-muted">Checking sign-in…</p>
          ) : !user ? (
            <div className="mt-5">
              <GuestAuthPanel
                onAuthed={() => undefined}
                title="Sign in to share a wish"
                subtitle="Use the same Google account you use for RSVP and photos."
                ctaLabel="Continue with Google"
              />
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-5 space-y-4">
              <label className="block">
                <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                  Your name
                </span>
                <input
                  className={cn(fieldClass, "mt-2")}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={60}
                  required
                  placeholder="How should we sign your wish?"
                />
              </label>
              <label className="block">
                <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                  Message / quote
                </span>
                <textarea
                  className={cn(fieldClass, "mt-2 min-h-28 resize-y")}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={400}
                  required
                  placeholder="A blessing, a memory, or a quote for the bride and groom…"
                />
                <span className="mt-1 block text-right font-body text-[11px] text-muted">
                  {body.length}/400
                </span>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={busy}>
                  <Send size={15} />
                  {busy ? "Sending…" : "Share wish"}
                </Button>
                {success ? (
                  <p className="font-body text-sm text-emerald-200">{success}</p>
                ) : null}
                {error ? (
                  <p className="font-body text-sm text-rose-200">{error}</p>
                ) : null}
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}
