"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Images, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { GalleryImage } from "@/lib/types";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/utils";

export function Gallery() {
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const item = active !== null ? gallery[active] : null;

  useEffect(() => {
    let alive = true;
    fetch("/api/gallery")
      .then((res) => res.json())
      .then((data: { gallery?: GalleryImage[] }) => {
        if (alive) setGallery(data.gallery ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section id="gallery" className="section-pad relative">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Moments"
          title="Gallery"
          subtitle={
            gallery.length
              ? "A collection of moments from our celebration"
              : "Photos coming soon — check back later"
          }
        />

        {gallery.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-gold/25 bg-white/[0.02] px-6 py-16 text-center">
            <Images className="mb-4 text-gold/50" size={32} />
            <p className="font-display text-xl text-cream">No photos yet</p>
            <p className="mt-2 font-body text-sm text-muted">
              Gallery images will appear here once they are added.
            </p>
          </div>
        ) : (
          <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
            {gallery.map((photo, i) => (
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
                <Image
                  src={photo.src}
                  alt={photo.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute inset-0 gold-border rounded-2xl" />
                <span className="absolute bottom-4 left-4 font-body text-[10px] uppercase tracking-[0.25em] text-gold-soft/90">
                  {photo.alt}
                </span>
              </motion.button>
            ))}
          </div>
        )}
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
