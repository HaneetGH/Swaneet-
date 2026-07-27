import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { RSVP } from "@/components/sections/RSVP";
import { wedding } from "@/data/wedding";

export const metadata: Metadata = {
  title: `RSVP | ${wedding.hashtag}`,
  description: `Reply to the invitation and share stay needs — ${wedding.hashtag}`,
};

export default function RsvpPage() {
  return (
    <main className="ambient-bg relative min-h-screen">
      <Navigation />
      <div className="pt-20">
        <RSVP />
      </div>
      <Footer />
    </main>
  );
}
