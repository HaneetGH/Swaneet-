import type { Metadata } from "next";
import Link from "next/link";
import { PhotographerPortal } from "@/components/photographer/PhotographerPortal";
import { wedding } from "@/data/wedding";

export const metadata: Metadata = {
  title: `Photographer upload | ${wedding.hashtag}`,
  description: `Bulk photo and video upload desk for ${wedding.hashtag}`,
  robots: { index: false, follow: false },
};

export default function PhotographerPage() {
  return (
    <main className="ambient-bg relative min-h-screen">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link
          href="/"
          className="font-script text-2xl text-gold-soft transition hover:text-gold"
        >
          {wedding.hashtag}
        </Link>
        <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted">
          Photographer
        </p>
      </div>
      <div className="px-5 pb-24 pt-4 sm:px-8">
        <PhotographerPortal />
      </div>
    </main>
  );
}
