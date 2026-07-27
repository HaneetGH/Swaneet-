"use client";

import { Camera, MessageCircleHeart } from "lucide-react";
import Link from "next/link";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { guestActionPath, wishesWritePath } from "@/lib/guest-paths";
import { useInvite } from "@/lib/invite-context";

/**
 * Top ATL shortcuts: Wish + photo upload → dedicated pages.
 */
export function GuestEngageBanner() {
  const invite = useInvite();
  const { enabled, ready } = useFeatureFlags();

  const showWishes = !ready || enabled("guest_messages");
  const showPhotos = !ready || enabled("guest_photos");

  if (!showWishes && !showPhotos) {
    return null;
  }

  return (
    <section
      aria-label="Guest actions"
      className="relative z-20 border-y border-gold/25 bg-[#120e16]/95"
    >
      <div className="mx-auto max-w-6xl px-5 py-5 sm:px-8 sm:py-6">
        <div className="mb-4 text-center sm:mb-5 sm:text-left">
          <p className="font-body text-[10px] uppercase tracking-[0.32em] text-gold/70">
            Your role as a guest
          </p>
          <p className="mt-1 font-display text-xl text-cream sm:text-2xl">
            Leave a blessing, share a moment
          </p>
          <p className="mt-1 font-body text-xs text-muted sm:text-sm">
            Sign in with Google when you are ready — family reviews before anything goes live
          </p>
        </div>

        <div
          className={`grid gap-3 ${
            showWishes && showPhotos ? "sm:grid-cols-2" : "sm:grid-cols-1"
          }`}
        >
          {showWishes ? (
            <Link
              href={wishesWritePath(invite)}
              className="group flex items-center justify-between gap-4 border border-gold/20 bg-gold/[0.04] px-4 py-3.5 transition hover:border-gold/40 hover:bg-gold/[0.07] sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold-soft">
                  <MessageCircleHeart size={17} />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block font-body text-[10px] uppercase tracking-[0.28em] text-gold/70">
                    Wishes
                  </span>
                  <span className="font-display text-lg text-cream">
                    Write a review &amp; blessing
                  </span>
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft px-4 py-2 font-body text-[10px] uppercase tracking-[0.18em] text-[#1a1208] sm:text-xs">
                Wish
              </span>
            </Link>
          ) : null}

          {showPhotos ? (
            <Link
              href={guestActionPath("/upload", invite)}
              className="group flex items-center justify-between gap-4 border border-gold/20 bg-gold/[0.04] px-4 py-3.5 transition hover:border-gold/40 hover:bg-gold/[0.07] sm:px-5"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold-soft">
                  <Camera size={17} />
                </span>
                <span className="min-w-0 text-left">
                  <span className="block font-body text-[10px] uppercase tracking-[0.28em] text-gold/70">
                    Photos
                  </span>
                  <span className="font-display text-lg text-cream">
                    Upload a photo you took
                  </span>
                </span>
              </span>
              <span className="shrink-0 rounded-full border border-gold/45 px-4 py-2 font-body text-[10px] uppercase tracking-[0.18em] text-gold-soft transition group-hover:border-gold group-hover:text-gold sm:text-xs">
                Upload
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
