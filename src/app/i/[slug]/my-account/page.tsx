import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GuestAccountPanel } from "@/components/account/GuestAccountPanel";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
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
  if (!invite) return { title: "My account" };
  return {
    title: `My account | ${invite.label} | ${wedding.hashtag}`,
    description: `Your RSVP, stay, uploads, and wishes for ${invite.label}`,
    robots: { index: false, follow: false },
  };
}

export default async function InviteMyAccountPage({ params }: Params) {
  const { slug } = await params;
  const invite = getBrideInvite(slug);
  if (!invite) notFound();

  return (
    <InviteProvider invite={invite}>
      <main className="ambient-bg relative min-h-screen">
        <Navigation />
        <div className="mx-auto max-w-6xl px-5 pb-24 pt-28 sm:px-8">
          <GuestAccountPanel />
        </div>
        <Footer />
      </main>
    </InviteProvider>
  );
}
