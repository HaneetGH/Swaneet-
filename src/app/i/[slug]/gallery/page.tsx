import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { GalleryFull } from "@/components/sections/Gallery";
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
  if (!invite) return { title: "Gallery" };
  return {
    title: `Gallery | ${invite.label} | ${wedding.hashtag}`,
    description: `Wedding photos — ${invite.label}`,
    robots: { index: false, follow: false },
  };
}

export default async function InviteGalleryPage({ params }: Params) {
  const { slug } = await params;
  const invite = getBrideInvite(slug);
  if (!invite) notFound();

  return (
    <InviteProvider invite={invite}>
      <main className="ambient-bg relative min-h-screen">
        <Navigation />
        <div className="pt-20">
          <Suspense
            fallback={
              <p className="px-5 py-24 text-center font-body text-sm text-muted">
                Loading gallery…
              </p>
            }
          >
            <GalleryFull />
          </Suspense>
        </div>
        <Footer />
      </main>
    </InviteProvider>
  );
}