import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Great_Vibes, Outfit } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/layout/Providers";
import { wedding } from "@/data/wedding";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const script = Great_Vibes({
  variable: "--font-great-vibes",
  subsets: ["latin"],
  weight: ["400"],
});

const body = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://swaneet.wedding"),
  title: `${wedding.couple.groom.name} & ${wedding.couple.bride.name} | ${wedding.hashtag}`,
  description: `You are cordially invited to the wedding of ${wedding.couple.groom.name} and ${wedding.couple.bride.name} on 12th & 13th August 2026 at Maple Garden (A Unit of Sukhmani Resort), Buria Road, Jagadhri.`,
  keywords: [
    "wedding",
    wedding.couple.groom.name,
    wedding.couple.bride.name,
    "Swaneet",
    "Anand Karaj",
    "Jagadhri",
    "Maple Garden",
  ],
  openGraph: {
    title: `${wedding.couple.groom.firstName} & ${wedding.couple.bride.firstName} — ${wedding.hashtag}`,
    description:
      "Wedding Dinner on 12th August 2026 · Anand Karaj & Brunch on 13th August 2026 · Maple Garden (A Unit of Sukhmani Resort), Buria Road, Jagadhri",
    type: "website",
    images: [{ url: "/images/invitation.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${wedding.couple.groom.firstName} & ${wedding.couple.bride.firstName}`,
    description:
      "12th & 13th August 2026 · Maple Garden (A Unit of Sukhmani Resort), Buria Road, Jagadhri",
    images: ["/images/invitation.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#07060a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${script.variable} ${body.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
