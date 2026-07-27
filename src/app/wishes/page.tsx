import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { GuestWishes } from "@/components/sections/GuestWishes";
import { wedding } from "@/data/wedding";

export const metadata: Metadata = {
  title: `Wishes | ${wedding.hashtag}`,
  description: `Guest blessings and wishes for ${wedding.couple.groom.name} & ${wedding.couple.bride.name}`,
};

export default function WishesPage() {
  return (
    <main className="ambient-bg relative min-h-screen">
      <Navigation />
      <div className="pt-20">
        <GuestWishes />
      </div>
      <Footer />
    </main>
  );
}
