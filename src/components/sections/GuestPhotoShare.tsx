"use client";

import { upload } from "@vercel/blob/client";
import type { User } from "firebase/auth";
import { Camera, Check, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
  GuestAuthPanel,
  getGuestIdToken,
  signOutGuest,
} from "@/components/rsvp/GuestAuthPanel";
import { Button } from "@/components/ui/Button";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { cn } from "@/lib/utils";

const MAX_FILES = 5;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

type PreviewItem = {
  id: string;
  file: File;
  url: string;
};

function safeFilename(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 80) || "photo";
}

export function GuestPhotoShare() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  const onAuthed = useCallback((next: User) => {
    setUser(next);
  }, []);

  const clearPreviews = () => {
    previews.forEach((item) => URL.revokeObjectURL(item.url));
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const images = Array.from(list).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!images.length) {
      setError("Please choose image files only");
      return;
    }

    const available = MAX_FILES - previews.length;
    if (available <= 0) {
      setError(`You can share up to ${MAX_FILES} photos at once`);
      return;
    }

    const accepted = images.slice(0, available);
    setError(
      images.length > available
        ? `Maximum ${MAX_FILES} photos — added the first ${available}`
        : "",
    );
    setPreviews((prev) => [
      ...prev,
      ...accepted.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previews.length) {
      setError("Choose at least one photo");
      return;
    }

    setUploading(true);
    setError("");
    setProgress("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setError("Please sign in again");
        setUser(null);
        return;
      }

      const media: Array<{ src: string; alt: string; aspect: "square" }> = [];
      for (const [index, item] of previews.entries()) {
        setProgress(`Uploading ${index + 1} of ${previews.length}…`);
        const pathname = `guest/${Date.now()}-${safeFilename(item.file.name)}`;
        const blob = await upload(pathname, item.file, {
          access: "public",
          handleUploadUrl: "/api/gallery/guest/upload",
          headers: { Authorization: `Bearer ${token}` },
          contentType: item.file.type || "image/jpeg",
        });
        media.push({
          src: blob.url,
          alt: item.file.name.replace(/\.[^.]+$/, ""),
          aspect: "square",
        });
      }

      setProgress("Sending for review…");
      const res = await fetch("/api/gallery/guest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ media }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not share photos");
        return;
      }

      clearPreviews();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  return (
    <section id="share-photos" className="section-pad relative scroll-mt-24 pt-10 sm:pt-14">
      <div className="mx-auto max-w-xl">
        <SectionHeading
          eyebrow="Share"
          title="Add a photo"
          subtitle="Quick upload — we’ll review before it appears in the gallery"
        />

        {done ? (
          <div className="rounded-2xl border border-gold/25 bg-gold/10 px-5 py-8 text-center">
            <Check className="mx-auto mb-3 text-gold" size={28} />
            <p className="font-display text-2xl text-cream">Thank you</p>
            <p className="mt-2 font-body text-sm text-muted">
              Your photos are with the family for a quick review.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-5"
              onClick={() => setDone(false)}
            >
              Share more
            </Button>
          </div>
        ) : !user ? (
          <GuestAuthPanel
            onAuthed={onAuthed}
            title="Share a moment"
            subtitle="Sign in with Google for a quick photo upload. Photos go live after the family approves them."
            ctaLabel="Sign in to upload"
          />
        ) : (
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-gold/25 bg-[#100e14] px-5 py-6"
          >
            <p className="font-body text-[10px] uppercase tracking-[0.3em] text-gold/70">
              Signed in · {user.email || user.displayName || "Guest"}
            </p>

            <div
              className={cn(
                "mt-4 rounded-2xl border border-dashed border-gold/30 bg-[#0d0b10] px-4 py-8 text-center",
              )}
            >
              <Camera className="mx-auto mb-3 text-gold/70" size={28} />
              <p className="font-display text-xl text-cream">Drop photos here</p>
              <p className="mt-1 font-body text-xs text-muted">
                JPG, PNG, WEBP, GIF · up to {MAX_FILES} at once
              </p>
              <Button
                type="button"
                className="mt-5"
                disabled={previews.length >= MAX_FILES}
                onClick={() => inputRef.current?.click()}
              >
                Choose photos
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>

            {previews.length > 0 ? (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {previews.map((item) => (
                  <div
                    key={item.id}
                    className="relative aspect-square overflow-hidden rounded-xl border border-gold/20"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-cream"
                      aria-label="Remove photo"
                      onClick={() => {
                        URL.revokeObjectURL(item.url);
                        setPreviews((prev) =>
                          prev.filter((p) => p.id !== item.id),
                        );
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {error ? (
              <p className="mt-3 text-xs text-red-300">{error}</p>
            ) : null}
            {progress ? (
              <p className="mt-3 text-xs text-gold-soft">{progress}</p>
            ) : null}

            <Button
              type="submit"
              className="mt-5 w-full"
              disabled={uploading || !previews.length}
            >
              {uploading
                ? progress || "Uploading…"
                : previews.length
                  ? `Share ${previews.length} photo${previews.length === 1 ? "" : "s"}`
                  : "Choose photos to share"}
            </Button>

            <button
              type="button"
              className="mt-3 w-full font-body text-xs text-muted hover:text-cream"
              onClick={async () => {
                await signOutGuest();
                clearPreviews();
                setUser(null);
              }}
            >
              Sign out
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
