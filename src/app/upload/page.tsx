import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { Navigation } from "@/components/layout/Navigation";
import { GuestPhotoShare } from "@/components/sections/GuestPhotoShare";
import { wedding } from "@/data/wedding";

export const metadata: Metadata = {
  title: `Upload photos | ${wedding.hashtag}`,
  description: `Share wedding photos for the gallery — ${wedding.hashtag}`,
};

export default function UploadPage() {
  return (
    <main className="ambient-bg relative min-h-screen">
      <Navigation />
      <div className="pt-20">
        <GuestPhotoShare />
      </div>
      <Footer />
    </main>
  );
}
