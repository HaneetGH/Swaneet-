"use client";

import Image from "next/image";
import { Download, ScanFace } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { GalleryImage } from "@/lib/types";

async function downloadPhoto(photo: GalleryImage) {
  const filename = `${(photo.alt || "swaneet-photo").replace(/[^\w.-]+/g, "-").slice(0, 40)}.jpg`;
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

export function SharedPhotosPanel({ token }: { token: string }) {
  const [title, setTitle] = useState("Your photos");
  const [photos, setPhotos] = useState<GalleryImage[]>([]);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/face/shared?t=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "This link is invalid or expired");
        setPhotos([]);
        return;
      }
      setTitle(data.title || "Your photos");
      setPhotos(data.photos || []);
      setExpiresAt(data.expiresAt || null);
    } catch {
      setError("Could not load photos");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <ScanFace className="text-gold" size={18} />
        <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted">
          Private album
        </p>
      </div>
      <h1 className="font-display text-3xl text-cream sm:text-4xl">{title}</h1>
      {expiresAt ? (
        <p className="mt-2 font-body text-xs text-muted">
          Link valid until{" "}
          {new Date(expiresAt).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 font-body text-sm text-muted">Loading photos…</p>
      ) : error ? (
        <p className="mt-8 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 font-body text-sm text-red-200">
          {error}
        </p>
      ) : photos.length === 0 ? (
        <p className="mt-8 font-body text-sm text-muted">No photos on this link.</p>
      ) : (
        <>
          <p className="mt-4 font-body text-sm text-muted">
            {photos.length} photo{photos.length === 1 ? "" : "s"} · tap download
            on any image
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square overflow-hidden rounded-2xl border border-gold/15 bg-black/30"
              >
                <Image
                  src={photo.src}
                  alt={photo.alt || "Wedding photo"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => void downloadPhoto(photo)}
                  className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1.5 font-body text-[10px] uppercase tracking-[0.14em] text-cream opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Download size={12} />
                  Save
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
