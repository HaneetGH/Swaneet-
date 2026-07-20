import { Suspense } from "react";
import type { Metadata } from "next";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { GalleryFull } from "@/components/sections/Gallery";
import { wedding } from "@/data/wedding";

export const metadata: Metadata = {
  title: `Gallery | ${wedding.hashtag}`,
  description: `Wedding photos — ${wedding.couple.groom.name} & ${wedding.couple.bride.name}`,
};

export default function GalleryPage() {
  return (
    <main className="ambient-bg relative min-h-screen">
      <Navigation />
      <div className="pt-20">
        <Suspense
          fallback={
            <p className="px-5 py-24 text-center font-body text-sm text-muted">
              Loading gallery…
            </p>
          }
        >
          <GalleryFull />
        </Suspense>
      </div>
      <Footer />
    </main>
  );
}
