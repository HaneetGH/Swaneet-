import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { Events } from "@/components/sections/Events";
import { Venue } from "@/components/sections/Venue";
import { Gallery } from "@/components/sections/Gallery";
import { GuestEngageBanner } from "@/components/sections/GuestEngageBanner";
import { DownloadPhotosBanner } from "@/components/sections/DownloadPhotosBanner";
import { RsvpStayBanner } from "@/components/sections/RsvpStayBanner";
import { Family } from "@/components/sections/Family";
import { GuestWelcomeGuide } from "@/components/ui/GuestWelcomeGuide";

/**
 * Invitation page with top ATL banners.
 * Full RSVP / wishes / upload forms live on /rsvp, /wishes, /upload.
 */
export default function Home() {
  return (
    <main className="ambient-bg relative min-h-screen">
      <Navigation />
      <Hero />
      <GuestEngageBanner />
      <DownloadPhotosBanner />
      <RsvpStayBanner />
      <Events />
      <Venue />
      <Gallery />
      <Family />
      <Footer />
      <GuestWelcomeGuide />
    </main>
  );
}
