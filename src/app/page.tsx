import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { Countdown } from "@/components/sections/Countdown";
import { OurStory } from "@/components/sections/OurStory";
import { Events } from "@/components/sections/Events";
import { Venue } from "@/components/sections/Venue";
import { Gallery } from "@/components/sections/Gallery";
import { Family } from "@/components/sections/Family";
import { GuestWelcomeGuide } from "@/components/ui/GuestWelcomeGuide";

/** Invitation-only homepage — guest actions live on /rsvp, /wishes, /upload. */
export default function Home() {
  return (
    <main className="ambient-bg relative min-h-screen">
      <Navigation />
      <Hero />
      <Countdown />
      <OurStory />
      <Events />
      <Venue />
      <Gallery />
      <Family />
      <Footer />
      <GuestWelcomeGuide />
    </main>
  );
}
