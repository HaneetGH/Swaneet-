"use client";

import { BedDouble, Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { guestActionPath } from "@/lib/guest-paths";
import { useInvite } from "@/lib/invite-context";

/** Shortcut to RSVP + stay (not shown on invitation-only home). */
export function RsvpStayBanner() {
  const invite = useInvite();
  const { enabled, ready } = useFeatureFlags();
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/site-banner")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { banner?: { imageUrl?: string } } | null) => {
        if (active && data?.banner?.imageUrl) {
          setImageUrl(data.banner.imageUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (ready && (!enabled("stay_banner") || !enabled("accommodation"))) {
    return null;
  }

  return (
    <div className="relative z-20 border-b border-gold/25 bg-[#120e16]/95">
      {imageUrl ? (
        <div className="relative mx-auto aspect-[21/7] max-h-48 w-full max-w-6xl overflow-hidden sm:aspect-[24/7] sm:max-h-56">
          <Image
            src={imageUrl}
            alt="RSVP and stay"
            fill
            className="object-cover"
            sizes="(max-width: 1152px) 100vw, 1152px"
            unoptimized={imageUrl.startsWith("/uploads/")}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#120e16] via-[#120e16]/35 to-transparent" />
        </div>
      ) : null}

      <Link
        href={guestActionPath("/rsvp", invite)}
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-gold/5 sm:px-8"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold-soft">
            <BedDouble size={16} />
          </span>
          <span className="min-w-0 text-left">
            <span className="block font-body text-[10px] uppercase tracking-[0.28em] text-gold/70">
              RSVP
            </span>
            <span className="font-display text-lg text-cream sm:text-xl">
              Need Accommodation?
            </span>
            <span className="mt-0.5 block truncate font-body text-xs text-muted">
              Reply to the invite and tell us if you need a stay
            </span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft px-4 py-2 font-body text-[10px] uppercase tracking-[0.18em] text-[#1a1208] sm:px-5 sm:text-xs">
          <Heart size={12} fill="currentColor" />
          RSVP
        </span>
      </Link>
    </div>
  );
}
