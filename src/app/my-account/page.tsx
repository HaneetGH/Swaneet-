import type { Metadata } from "next";
import { GuestAccountPanel } from "@/components/account/GuestAccountPanel";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { wedding } from "@/data/wedding";

export const metadata: Metadata = {
  title: `My account | ${wedding.hashtag}`,
  description: `Your RSVP, stay booking, photo uploads, and questions — ${wedding.hashtag}`,
};

export default function MyAccountPage() {
  return (
    <main className="ambient-bg relative min-h-screen">
      <Navigation />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-28 sm:px-8">
        <GuestAccountPanel />
      </div>
      <Footer />
    </main>
  );
}
