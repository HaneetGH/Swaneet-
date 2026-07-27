import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { Countdown } from "@/components/sections/Countdown";
import { OurStory } from "@/components/sections/OurStory";
import { Events } from "@/components/sections/Events";
import { Venue } from "@/components/sections/Venue";
import { Gallery } from "@/components/sections/Gallery";
import { GuestPhotoShare } from "@/components/sections/GuestPhotoShare";
import { SharePhotosBanner } from "@/components/sections/SharePhotosBanner";
import { DownloadPhotosBanner } from "@/components/sections/DownloadPhotosBanner";
import { RsvpStayBanner } from "@/components/sections/RsvpStayBanner";
import { Family } from "@/components/sections/Family";
import { GuestWishes } from "@/components/sections/GuestWishes";
import { RSVP } from "@/components/sections/RSVP";
import { GuestWelcomeGuide } from "@/components/ui/GuestWelcomeGuide";

export default function Home() {
  return (
    <main className="ambient-bg relative min-h-screen">
      <Navigation />
      <Hero />
      <DownloadPhotosBanner />
      <SharePhotosBanner />
      <RsvpStayBanner />
      <Countdown />
      <OurStory />
      <Events />
      <Venue />
      <Gallery />
      <Family />
      <GuestWishes />
      <RSVP />
      <GuestPhotoShare />
      <Footer />
      <GuestWelcomeGuide />
    </main>
  );
}
