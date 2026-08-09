import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { Events } from "@/components/sections/Events";
import { Family } from "@/components/sections/Family";
import { Gallery } from "@/components/sections/Gallery";
import { GuestEngageBanner } from "@/components/sections/GuestEngageBanner";
import { Hero } from "@/components/sections/Hero";
import { DownloadPhotosBanner } from "@/components/sections/DownloadPhotosBanner";
import { OurStory } from "@/components/sections/OurStory";
import { RsvpStayBanner } from "@/components/sections/RsvpStayBanner";
import { Venue } from "@/components/sections/Venue";
import { GuestWelcomeGuide } from "@/components/ui/GuestWelcomeGuide";
import { getBrideInvite } from "@/data/bride-invites";
import { InviteProvider } from "@/lib/invite-context";
import { wedding } from "@/data/wedding";

type Params = { params: Promise<{ slug: string }> };

/** Only the two known invite slugs are valid — everything else 404s. */
export const dynamicParams = false;

export async function generateStaticParams() {
  return [
    { slug: "swnt-chugh-mehfil-k7m2" },
    { slug: "swnt-chugh-laavan-p9x4" },
  ];
}

export async function generateMetadata({ params }: Params) {
  const { slug } = await params;
  const invite = getBrideInvite(slug);
  if (!invite) return { title: "Invite" };
  return {
    title: `${invite.label} | ${wedding.hashtag}`,
    description: invite.subtitle,
    robots: { index: false, follow: false },
  };
}

/**
 * Bride invite with top ATL banners (including Wish).
 * Full forms live on /i/[slug]/rsvp|wishes|upload|my-account|my-photos|gallery.
 * Our Story is behind the per-site `our_story` feature flag.
 */
export default async function BrideInvitePage({ params }: Params) {
  const { slug } = await params;
  const invite = getBrideInvite(slug);
  if (!invite) notFound();

  return (
    <InviteProvider invite={invite}>
      <main className="ambient-bg relative min-h-screen">
        <Navigation />
        <Hero />
        <GuestEngageBanner />
        <DownloadPhotosBanner />
        <RsvpStayBanner />
        <OurStory />
        <Events />
        <Venue />
        <Gallery />
        <Family />
        <Footer />
        <GuestWelcomeGuide />
      </main>
    </InviteProvider>
  );
}
