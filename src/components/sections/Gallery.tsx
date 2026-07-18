"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { wedding } from "@/data/wedding";
import type { GalleryImage } from "@/lib/types";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/utils";

const gradients = [
  "from-[#3a1c24] via-[#1a1520] to-[#2a2110]",
  "from-[#1a1520] via-[#2a2110] to-[#3a1c24]",
  "from-[#241820] via-[#100e14] to-[#3a2a14]",
  "from-[#1c1420] via-[#2a1818] to-[#1a2010]",
  "from-[#201818] via-[#1a1520] to-[#2a2410]",
  "from-[#181420] via-[#241818] to-[#1a2018]",
];

const fallbackGallery: GalleryImage[] = wedding.gallery.map((item) => ({
  id: String(item.id),
  alt: item.alt,
  src: "/images/invitation.png",
  aspect: item.aspect,
  createdAt: new Date(0).toISOString(),
}));

export function Gallery() {
  const [gallery, setGallery] = useState<GalleryImage[]>(fallbackGallery);
  const [active, setActive] = useState<number | null>(null);
  const item = active !== null ? gallery[active] : null;

  useEffect(() => {
    let alive = true;
    fetch("/api/gallery")
      .then((res) => res.json())
      .then((data: { gallery?: GalleryImage[] }) => {
        if (alive && data.gallery?.length) setGallery(data.gallery);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const hasUploads = gallery.some((photo) => photo.src !== "/images/invitation.png");

  return (
    <section id="gallery" className="section-pad relative">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Moments"
          title="Gallery"
          subtitle={
            hasUploads
              ? "A collection of moments from our celebration"
              : "Placeholder frames inspired by the invitation — replace with your photographs"
          }
        />

        <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
          {gallery.map((photo, i) => {
            const isPlaceholder = photo.src === "/images/invitation.png";
            return (
              <motion.button
                key={photo.id}
                type="button"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.6, delay: i * 0.06 }}
                onClick={() => setActive(i)}
                className={cn(
                  "group relative mb-4 block w-full overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  photo.aspect === "portrait" && "aspect-[3/4]",
                  photo.aspect === "landscape" && "aspect-[4/3]",
                  photo.aspect === "square" && "aspect-square",
                )}
                aria-label={`Open ${photo.alt}`}
              >
                {isPlaceholder ? (
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-90 transition duration-500 group-hover:scale-105",
                      gradients[i % gradients.length],
                    )}
                  />
                ) : null}
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className={cn(
                    "object-cover transition duration-700 group-hover:scale-105",
                    isPlaceholder
                      ? "opacity-40 mix-blend-luminosity group-hover:opacity-55"
                      : "opacity-100",
                  )}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute inset-0 gold-border rounded-2xl" />
                <span className="absolute bottom-4 left-4 font-body text-[10px] uppercase tracking-[0.25em] text-gold-soft/90">
                  {photo.alt}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {item && active !== null ? (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
            role="dialog"
            aria-modal
            aria-label="Gallery lightbox"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="relative max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-[4/3] bg-[#100e14]">
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-cream"
                aria-label="Close lightbox"
              >
                <X size={18} />
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}
