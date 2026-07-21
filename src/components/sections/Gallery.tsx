"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Download, Images, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  GuestAuthPanel,
  getGuestIdToken,
} from "@/components/rsvp/GuestAuthPanel";
import { wedding } from "@/data/wedding";
import { sortEventsByDateTime } from "@/lib/datetime";
import { trackGuestActivity } from "@/lib/guest-activity";
import { useInvite } from "@/lib/invite-context";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import {
  getFirebaseAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import type { GalleryImage, ManagedEvent } from "@/lib/types";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/utils";

const fallbackEvents: ManagedEvent[] = sortEventsByDateTime(
  wedding.events.map((event) => ({
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
  })),
);

const PREVIEW_PER_EVENT = 3;

function filenameForMedia(photo: GalleryImage) {
  const fromUrl = photo.src.split("?")[0]?.split("/").pop();
  if (fromUrl && /\.[a-z0-9]{2,5}$/i.test(fromUrl)) return fromUrl;
  const safe = (photo.alt || "swaneet-photo")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${safe || "swaneet"}-${photo.id.slice(0, 8)}.${
    photo.kind === "video" ? "mp4" : "jpg"
  }`;
}

async function downloadMedia(photo: GalleryImage, inviteSlug?: string) {
  const filename = filenameForMedia(photo);
  void trackGuestActivity(
    "gallery_download",
    inviteSlug ? `invite:${inviteSlug}|${photo.id}` : photo.id,
  );
  try {
    const response = await fetch(photo.src);
    if (!response.ok) throw new Error("fetch failed");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  } catch {
    window.open(photo.src, "_blank", "noopener,noreferrer");
  }
}

function DownloadButton({
  photo,
  className,
}: {
  photo: GalleryImage;
  className?: string;
}) {
  const invite = useInvite();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setBusy(true);
        void downloadMedia(photo, invite?.slug).finally(() => setBusy(false));
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-black/55 text-cream backdrop-blur-sm transition hover:bg-black/75 disabled:opacity-60",
        className,
      )}
      aria-label={`Download ${photo.alt || "photo"}`}
      title="Download"
    >
      <Download size={16} />
    </button>
  );
}

function MediaTile({
  photo,
  index,
  onOpen,
  sizes,
  href,
}: {
  photo: GalleryImage;
  index: number;
  onOpen?: () => void;
  sizes: string;
  href?: string;
}) {
  const media = (
    <>
      {photo.kind === "video" ? (
        <video
          src={photo.src}
          className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          sizes={sizes}
          className="object-cover transition duration-700 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      <div className="absolute inset-0 gold-border rounded-2xl" />
    </>
  );

  const shellClass =
    "relative aspect-square w-full overflow-hidden rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-gold";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className="group relative"
    >
      {href ? (
        <Link
          href={href}
          className={cn(shellClass, "block")}
          aria-label={`View gallery`}
        >
          {media}
        </Link>
      ) : onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className={shellClass}
          aria-label={`Open ${photo.alt}`}
        >
          {media}
        </button>
      ) : (
        <div className={shellClass}>{media}</div>
      )}
      <DownloadButton
        photo={photo}
        className="absolute bottom-2 right-2 z-10 h-9 w-9 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      />
    </motion.div>
  );
}

function useGuestUser() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseClientConfigured()) {
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(getFirebaseAuth(), (next) => {
      setUser(next);
      setAuthReady(true);
    });
  }, []);

  const onAuthed = useCallback((next: User) => {
    setUser(next);
  }, []);

  return { user, authReady, onAuthed };
}

function useGalleryData(
  user: User | null,
  galleryEnabled: boolean,
  site: "main" | "mehfil" | "laavan",
) {
  const invite = useInvite();
  const [gallery, setGallery] = useState<GalleryImage[]>([]);
  const [events, setEvents] = useState<ManagedEvent[]>(fallbackEvents);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !galleryEnabled) {
      setGallery([]);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);

    (async () => {
      try {
        const token = await getGuestIdToken();
        if (!token || !alive) return;

        const [galleryRes, eventsRes] = await Promise.all([
          fetch(`/api/gallery?site=${encodeURIComponent(site)}`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }),
          fetch("/api/events"),
        ]);
        const galleryData = await galleryRes.json().catch(() => ({}));
        const eventsData = await eventsRes.json().catch(() => ({}));
        if (!alive) return;
        setGallery(
          galleryRes.ok ? ((galleryData.gallery as GalleryImage[]) ?? []) : [],
        );
        if (galleryRes.ok) {
          void trackGuestActivity(
            "gallery_view",
            invite?.slug ? `invite:${invite.slug}` : undefined,
          );
        }
        if (eventsData.events?.length) {
          setEvents(sortEventsByDateTime(eventsData.events));
        }
      } catch {
        if (alive) setGallery([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, invite?.slug, galleryEnabled, site]);

  return { gallery, events, loading };
}

function GalleryLoginGate({
  onAuthed,
}: {
  onAuthed: (user: User) => void;
}) {
  return (
    <div className="mx-auto max-w-md">
      <GuestAuthPanel
        onAuthed={onAuthed}
        title="View the gallery"
        subtitle="Sign in with Google to see wedding photos. Only guests who sign in can open the gallery."
        ctaLabel="Continue with Google"
      />
    </div>
  );
}

/** Compact homepage preview: up to 3 photos per event + View more */
export function Gallery() {
  const { enabled, ready: flagsReady, site } = useFeatureFlags();
  const galleryOn = flagsReady && enabled("gallery");
  const { user, authReady, onAuthed } = useGuestUser();
  const { gallery, events, loading } = useGalleryData(user, galleryOn, site);

  const groups = useMemo(() => {
    const result: {
      key: string;
      title: string;
      images: GalleryImage[];
      total: number;
    }[] = [];
    for (const event of events) {
      const images = gallery.filter((image) => image.eventId === event.id);
      if (!images.length) continue;
      result.push({
        key: event.id,
        title: event.name,
        images: images.slice(0, PREVIEW_PER_EVENT),
        total: images.length,
      });
    }
    const unassigned = gallery.filter((image) => !image.eventId);
    if (unassigned.length) {
      result.push({
        key: "unassigned",
        title: "More moments",
        images: unassigned.slice(0, PREVIEW_PER_EVENT),
        total: unassigned.length,
      });
    }
    return result;
  }, [events, gallery]);

  return (
    <section id="gallery" className="section-pad relative">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Moments"
          title="Gallery"
          subtitle={
            flagsReady && !enabled("gallery")
              ? "Gallery is temporarily closed for this invite"
              : !user
                ? "Sign in with Google to view wedding photos"
                : gallery.length
                  ? "A glimpse from each celebration — open the full gallery for more"
                  : "Photos coming soon — check back later"
          }
        />

        {flagsReady && !enabled("gallery") ? (
          <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-gold/25 bg-white/[0.02] px-6 py-16 text-center">
            <Images className="mb-4 text-gold/50" size={32} />
            <p className="font-display text-xl text-cream">Gallery closed</p>
            <p className="mt-2 font-body text-sm text-muted">
              The host has turned off gallery viewing for this page.
            </p>
          </div>
        ) : !authReady || !flagsReady ? (
          <p className="text-center font-body text-sm text-muted">Loading…</p>
        ) : !user ? (
          <GalleryLoginGate onAuthed={onAuthed} />
        ) : loading ? (
          <p className="text-center font-body text-sm text-muted">
            Loading photos…
          </p>
        ) : gallery.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-gold/25 bg-white/[0.02] px-6 py-16 text-center">
            <Images className="mb-4 text-gold/50" size={32} />
            <p className="font-display text-xl text-cream">No photos yet</p>
            <p className="mt-2 font-body text-sm text-muted">
              Share a moment below — approved photos will show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-10 flex justify-center">
              <Link
                href="/gallery"
                className="rounded-full border border-gold/30 bg-gold/10 px-6 py-2.5 font-body text-[10px] uppercase tracking-[0.22em] text-gold-soft transition hover:bg-gold/20"
              >
                View all photos
              </Link>
            </div>

            <div className="space-y-14">
              {groups.map((group) => (
                <div key={group.key}>
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="font-body text-[10px] uppercase tracking-[0.35em] text-gold/70">
                        Event
                      </p>
                      <h3 className="mt-1 font-display text-3xl text-cream">
                        {group.title}
                      </h3>
                    </div>
                    {group.total > PREVIEW_PER_EVENT ? (
                      <Link
                        href={
                          group.key === "unassigned"
                            ? "/gallery"
                            : `/gallery?event=${group.key}`
                        }
                        className="font-body text-[10px] uppercase tracking-[0.2em] text-gold-soft underline-offset-4 hover:underline"
                      >
                        View more ({group.total})
                      </Link>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    {group.images.map((photo, i) => (
                      <MediaTile
                        key={photo.id}
                        photo={photo}
                        index={i}
                        href={
                          group.key === "unassigned"
                            ? "/gallery"
                            : `/gallery?event=${group.key}`
                        }
                        sizes="(max-width: 640px) 33vw, 280px"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** Full gallery page with filters + lightbox */
export function GalleryFull() {
  const searchParams = useSearchParams();
  const eventFromUrl = searchParams.get("event") || "all";
  const { enabled, ready: flagsReady, site } = useFeatureFlags();
  const galleryOn = flagsReady && enabled("gallery");
  const { user, authReady, onAuthed } = useGuestUser();
  const { gallery, events, loading } = useGalleryData(user, galleryOn, site);
  const [filterEventId, setFilterEventId] = useState(eventFromUrl);
  const [active, setActive] = useState<GalleryImage | null>(null);

  useEffect(() => {
    setFilterEventId(eventFromUrl);
  }, [eventFromUrl]);

  const visibleEvents = useMemo(
    () =>
      events.filter((event) =>
        gallery.some((image) => image.eventId === event.id),
      ),
    [events, gallery],
  );

  const filteredGallery = useMemo(() => {
    if (filterEventId === "all") return gallery;
    if (filterEventId === "unassigned") {
      return gallery.filter((image) => !image.eventId);
    }
    return gallery.filter((image) => image.eventId === filterEventId);
  }, [filterEventId, gallery]);

  const groups = useMemo(() => {
    if (filterEventId !== "all") {
      const event = events.find((item) => item.id === filterEventId);
      const title =
        filterEventId === "unassigned"
          ? "More moments"
          : event?.name || "Photos";
      return filteredGallery.length
        ? [{ key: filterEventId, title, images: filteredGallery }]
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
    <section className="section-pad relative">
      <div className="mx-auto max-w-6xl">
        <SectionHeading
          eyebrow="Moments"
          title="Full gallery"
          subtitle={
            flagsReady && !enabled("gallery")
              ? "Gallery is temporarily closed"
              : !user
                ? "Sign in with Google to view wedding photos"
                : gallery.length
                  ? "Every photo from the celebrations"
                  : "Photos coming soon — check back later"
          }
        />

        <div className="mb-8 flex justify-center">
          <Link
            href="/#gallery"
            className="font-body text-[10px] uppercase tracking-[0.2em] text-muted hover:text-gold-soft"
          >
            ← Back to home
          </Link>
        </div>

        {flagsReady && !enabled("gallery") ? (
          <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-gold/25 bg-white/[0.02] px-6 py-16 text-center">
            <Images className="mb-4 text-gold/50" size={32} />
            <p className="font-display text-xl text-cream">Gallery closed</p>
          </div>
        ) : !authReady || !flagsReady ? (
          <p className="text-center font-body text-sm text-muted">
            Loading…
          </p>
        ) : !user ? (
          <GalleryLoginGate onAuthed={onAuthed} />
        ) : loading ? (
          <p className="text-center font-body text-sm text-muted">
            Loading photos…
          </p>
        ) : gallery.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center rounded-2xl border border-dashed border-gold/25 bg-white/[0.02] px-6 py-16 text-center">
            <Images className="mb-4 text-gold/50" size={32} />
            <p className="font-display text-xl text-cream">No photos yet</p>
          </div>
        ) : (
          <>
            {visibleEvents.length > 0 ? (
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
                <div key={group.key} id={`event-${group.key}`}>
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

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                    {group.images.map((photo, i) => (
                      <MediaTile
                        key={photo.id}
                        photo={photo}
                        index={i}
                        onOpen={() => setActive(photo)}
                        sizes="(max-width: 640px) 50vw, 33vw"
                      />
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
                {active.kind === "video" ? (
                  <video
                    src={active.src}
                    className="absolute inset-0 h-full w-full object-contain"
                    controls
                    playsInline
                    autoPlay
                  />
                ) : (
                  <Image
                    src={active.src}
                    alt={active.alt}
                    fill
                    className="object-contain"
                    sizes="100vw"
                    priority
                  />
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                <p className="min-w-0 truncate font-body text-xs text-cream/90">
                  {active.alt}
                </p>
                <button
                  type="button"
                  onClick={() => void downloadMedia(active)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-gold/30 bg-black/40 px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-gold-soft hover:bg-black/60"
                >
                  <Download size={14} />
                  Download
                </button>
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
