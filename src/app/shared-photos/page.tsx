import type { Metadata } from "next";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { SharedPhotosPanel } from "@/components/sections/SharedPhotosPanel";
import { wedding } from "@/data/wedding";

export const metadata: Metadata = {
  title: `Shared photos | ${wedding.hashtag}`,
  description: `Private wedding photo album — ${wedding.hashtag}`,
};

type Props = {
  searchParams: Promise<{ t?: string }>;
};

export default async function SharedPhotosPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.t?.trim() || "";

  return (
    <main className="ambient-bg relative min-h-screen">
      <Navigation />
      <div className="mx-auto max-w-5xl px-5 pb-24 pt-28 sm:px-8">
        {token ? (
          <SharedPhotosPanel token={token} />
        ) : (
          <p className="font-body text-sm text-muted">
            This page needs a private link from your email. Ask the family to
            send your photo album, or open Find my photos on the site.
          </p>
        )}
      </div>
      <Footer />
    </main>
  );
}
