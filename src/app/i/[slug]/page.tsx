import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { Countdown } from "@/components/sections/Countdown";
import { Events } from "@/components/sections/Events";
import { Family } from "@/components/sections/Family";
import { Gallery } from "@/components/sections/Gallery";
import { GuestPhotoShare } from "@/components/sections/GuestPhotoShare";
import { Hero } from "@/components/sections/Hero";
import { RSVP } from "@/components/sections/RSVP";
import { RsvpStayBanner } from "@/components/sections/RsvpStayBanner";
import { SharePhotosBanner } from "@/components/sections/SharePhotosBanner";
import { Venue } from "@/components/sections/Venue";
import { getBrideInvite } from "@/data/bride-invites";
import { InviteProvider } from "@/lib/invite-context";
import { wedding } from "@/data/wedding";

type Params = { params: Promise<{ slug: string }> };

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

export default async function BrideInvitePage({ params }: Params) {
  const { slug } = await params;
  const invite = getBrideInvite(slug);
  if (!invite) notFound();

  return (
    <InviteProvider invite={invite}>
      <main className="ambient-bg relative min-h-screen">
        <Navigation />
        <Hero />
        <SharePhotosBanner />
        <RsvpStayBanner />
        <Countdown />
        <Events />
        <Venue />
        <Gallery />
        <Family />
        <RSVP />
        <GuestPhotoShare />
        <Footer />
      </main>
    </InviteProvider>
  );
}
