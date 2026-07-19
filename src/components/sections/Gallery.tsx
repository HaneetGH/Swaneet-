"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Images, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { wedding } from "@/data/wedding";
import type { GalleryImage, ManagedEvent } from "@/lib/types";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/utils";

const fallbackEvents: ManagedEvent[] = wedding.events.map((event) => ({
  id: event.id,
  name: event.name,
  date: event.date,
  day: event.day,
  time: event.time,
  venue: event.venue,
  venueDetail: event.venueDetail,
  address: event.address,
  description: event.description,
  icon: event.icon,
}));

export function Gallery() {
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [events, setEvents] = useState<ManagedEvent[]>(fallbackEvents);
  const [filterEventId, setFilterEventId] = useState("all");
  const [active, setActive] = useState<GalleryImage | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/gallery").then((res) => res.json()),
      fetch("/api/events").then((res) => res.json()),
    ])
      .then(([galleryData, eventsData]) => {
        if (!alive) return;
        setGallery(galleryData.gallery ?? []);
        if (eventsData.events?.length) setEvents(eventsData.events);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const visibleEvents = useMemo(
    () =>
      events.filter((event) =>
        gallery.some((image) => image.eventId === event.id),
      ),
    [events, gallery],
  );

  const filteredGallery = useMemo(() => {
    if (filterEventId === "all") return gallery;
    return gallery.filter((image) => image.eventId === filterEventId);
  }, [filterEventId, gallery]);

  const groups = useMemo(() => {
    if (filterEventId !== "all") {
      const event = events.find((item) => item.id === filterEventId);
      return filteredGallery.length
        ? [
            {
              key: filterEventId,
              title: event?.name || "Photos",
              images: filteredGallery,
            },
          ]
        : [];
    }

    const result: { key: string; title: string; images: GalleryImage[] }[] = [];
    for (const event of events) {
      const images = gallery.filter((image) => image.eventId === event.id);
      if (images.length) {
        result.push({ key: event.id, title: event.name, images });
      }
    }
    const unassigned = gallery.filter((image) => !image.eventId);
    if (unassigned.length) {
      result.push({
        key: "unassigned",
        title: "More moments",
        images: unassigned,
      });
    }
    return result;
  }, [events, filterEventId, filteredGallery, gallery]);

  return (
    <section id="gallery" className="section-pad relative">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Moments"
          title="Gallery"
          subtitle={
            gallery.length
              ? "Photos from each celebration"
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
          <>
            {visibleEvents.length > 1 ? (
              <div className="mb-10 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setFilterEventId("all")}
                  className={cn(
                    "rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.2em] transition",
                    filterEventId === "all"
                      ? "border-gold bg-gold/15 text-gold-soft"
                      : "border-gold/20 text-muted hover:text-cream",
                  )}
                >
                  All events
                </button>
                {visibleEvents.map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setFilterEventId(event.id)}
                    className={cn(
                      "rounded-full border px-4 py-2 font-body text-[10px] uppercase tracking-[0.2em] transition",
                      filterEventId === event.id
                        ? "border-gold bg-gold/15 text-gold-soft"
                        : "border-gold/20 text-muted hover:text-cream",
                    )}
                  >
                    {event.name}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="space-y-14">
              {groups.map((group) => (
                <div key={group.key}>
                  {filterEventId === "all" ? (
                    <div className="mb-5 text-center">
                      <p className="font-body text-[10px] uppercase tracking-[0.35em] text-gold/70">
                        Event
                      </p>
                      <h3 className="mt-2 font-display text-3xl text-cream">
                        {group.title}
                      </h3>
                    </div>
                  ) : null}

                  <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
                    {group.images.map((photo, i) => (
                      <motion.button
                        key={photo.id}
                        type="button"
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-40px" }}
                        transition={{ duration: 0.6, delay: i * 0.06 }}
                        onClick={() => setActive(photo)}
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
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {active ? (
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
                  src={active.src}
                  alt={active.alt}
                  fill
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              </div>
              <p className="absolute bottom-3 left-4 font-body text-xs text-cream/90">
                {active.alt}
              </p>
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
