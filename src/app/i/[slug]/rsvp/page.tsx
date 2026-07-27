import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { RSVP } from "@/components/sections/RSVP";
import { getBrideInvite } from "@/data/bride-invites";
import { wedding } from "@/data/wedding";
import { InviteProvider } from "@/lib/invite-context";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  return [
    { slug: "swnt-chugh-mehfil-k7m2" },
    { slug: "swnt-chugh-laavan-p9x4" },
  ];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const invite = getBrideInvite(slug);
  if (!invite) return { title: "RSVP" };
  return {
    title: `RSVP | ${invite.label} | ${wedding.hashtag}`,
    description: `Reply for ${invite.label}`,
    robots: { index: false, follow: false },
  };
}

export default async function InviteRsvpPage({ params }: Params) {
  const { slug } = await params;
  const invite = getBrideInvite(slug);
  if (!invite) notFound();

  return (
    <InviteProvider invite={invite}>
      <main className="ambient-bg relative min-h-screen">
        <Navigation />
        <div className="pt-20">
          <RSVP />
        </div>
        <Footer />
      </main>
    </InviteProvider>
  );
}
