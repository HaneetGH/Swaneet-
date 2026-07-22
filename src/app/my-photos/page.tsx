import type { Metadata } from "next";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { FaceFindPanel } from "@/components/sections/FaceFindPanel";
import { wedding } from "@/data/wedding";

export const metadata: Metadata = {
  title: `My photos | ${wedding.hashtag}`,
  description: `Private album of wedding photos that look like you — ${wedding.hashtag}`,
};

export default function MyPhotosPage() {
  return (
    <main className="ambient-bg relative min-h-screen">
      <Navigation />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-28 sm:px-8">
        <FaceFindPanel />
      </div>
      <Footer />
    </main>
  );
}
