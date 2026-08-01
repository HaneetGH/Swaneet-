import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { FaceFindPanel } from "@/components/sections/FaceFindPanel";
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
  if (!invite) return { title: "My photos" };
  return {
    title: `My photos | ${invite.label} | ${wedding.hashtag}`,
    description: `Private album of wedding photos that look like you — ${invite.label}`,
    robots: { index: false, follow: false },
  };
}

export default async function InviteMyPhotosPage({ params }: Params) {
  const { slug } = await params;
  const invite = getBrideInvite(slug);
  if (!invite) notFound();

  return (
    <InviteProvider invite={invite}>
      <main className="ambient-bg relative min-h-screen">
        <Navigation />
        <div className="mx-auto max-w-5xl px-5 pb-24 pt-28 sm:px-8">
          <FaceFindPanel />
        </div>
        <Footer />
      </main>
    </InviteProvider>
  );
}
