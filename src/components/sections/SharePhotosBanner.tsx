"use client";

import { Camera } from "lucide-react";
import Link from "next/link";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { guestActionPath } from "@/lib/guest-paths";
import { useInvite } from "@/lib/invite-context";

/** Slim upload shortcut (not shown on invitation-only home). */
export function SharePhotosBanner() {
  const invite = useInvite();
  const { enabled, ready } = useFeatureFlags();

  if (ready && !enabled("guest_photos")) {
    return null;
  }

  return (
    <div className="relative z-20 border-y border-gold/25 bg-[#120e16]/95">
      <Link
        href={guestActionPath("/upload", invite)}
        className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-gold/5 sm:px-8"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold-soft">
            <Camera size={16} />
          </span>
          <span className="min-w-0 text-left">
            <span className="block font-body text-[10px] uppercase tracking-[0.28em] text-gold/70">
              Upload
            </span>
            <span className="font-display text-lg text-cream sm:text-xl">
              Share a photo you took
            </span>
            <span className="mt-0.5 block truncate font-body text-xs text-muted">
              Family reviews it before it appears in the gallery
            </span>
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft px-4 py-2 font-body text-[10px] uppercase tracking-[0.18em] text-[#1a1208] sm:px-5 sm:text-xs">
          Upload
        </span>
      </Link>
    </div>
  );
}
