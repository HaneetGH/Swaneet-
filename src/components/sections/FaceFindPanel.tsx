"use client";

import { upload } from "@vercel/blob/client";
import Image from "next/image";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Camera, Download, Images, RefreshCw, ScanFace } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  GuestAuthPanel,
  getGuestIdToken,
} from "@/components/rsvp/GuestAuthPanel";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import {
  getFirebaseAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import type { GalleryImage, GuestFaceProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

type ProfileResponse = {
  profile?: GuestFaceProfile | null;
  rekognitionReady?: boolean;
  error?: string;
  message?: string;
};

function safeFilename(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 80) || "selfie.jpg";
}

export function FaceFindPanel({ className }: { className?: string }) {
  const { enabled, ready: flagsReady, site } = useFeatureFlags();
  const faceOn = flagsReady && enabled("face_find");

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<GuestFaceProfile | null>(null);
  const [photos, setPhotos] = useState<GalleryImage[]>([]);
  const [rekognitionReady, setRekognitionReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isFirebaseClientConfigured()) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    let unsub: (() => void) | undefined;
    try {
      const auth = getFirebaseAuth();
      unsub = onAuthStateChanged(auth, (next) => {
        if (cancelled) return;
        setUser(next);
        setAuthReady(true);
      });
    } catch {
      setAuthReady(true);
    }

    const timeout = window.setTimeout(() => {
      if (!cancelled) setAuthReady(true);
    }, 2500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      unsub?.();
    };
  }, []);

  const load = useCallback(async () => {
    if (!user || !faceOn) return;
    const token = await getGuestIdToken();
    if (!token) return;
    const [profileRes, photosRes] = await Promise.all([
      fetch(`/api/face/profile?site=${encodeURIComponent(site)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }),
      fetch(`/api/face/my-photos?site=${encodeURIComponent(site)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }),
    ]);
    const profileData = (await profileRes.json().catch(() => ({}))) as ProfileResponse & {
      photos?: GalleryImage[];
    };
    const photosData = (await photosRes.json().catch(() => ({}))) as {
      photos?: GalleryImage[];
      error?: string;
    };
    if (profileRes.ok) {
      setProfile(profileData.profile || null);
      setRekognitionReady(profileData.rekognitionReady !== false);
    }
    if (photosRes.ok) {
      setPhotos(photosData.photos || []);
    }
  }, [user, faceOn, site]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!flagsReady || !faceOn) return null;

  const onUpload = async (file: File | null) => {
    if (!file || !user) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setError("Please sign in again");
        return;
      }

      // Direct-to-Blob avoids Vercel’s ~4.5MB serverless body limit (phone selfies are often larger)
      let selfieSrc: string | null = null;
      try {
        const pathname = `selfies/${Date.now()}-${safeFilename(file.name)}`;
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/face/selfie/upload",
          headers: { Authorization: `Bearer ${token}` },
          contentType: file.type || "image/jpeg",
          clientPayload: JSON.stringify({ site }),
        });
        selfieSrc = blob.url;
      } catch {
        // Local / no Blob: fall back to multipart for small files only
        if (file.size > 4 * 1024 * 1024) {
          setError(
            "Selfie is too large and Blob upload failed. Use a photo under 4MB, or connect Vercel Blob.",
          );
          return;
        }
      }

      const res = selfieSrc
        ? await fetch(`/api/face/profile?site=${encodeURIComponent(site)}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ selfieSrc }),
          })
        : await fetch(`/api/face/profile?site=${encodeURIComponent(site)}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: (() => {
              const body = new FormData();
              body.set("selfie", file);
              return body;
            })(),
          });

      const data = (await res.json().catch(() => ({}))) as ProfileResponse;
      if (!res.ok) {
        setError(data.error || "Could not process selfie");
        return;
      }
      setProfile(data.profile || null);
      setMessage(data.message || "Selfie saved");
      await load();
    } catch {
      setError("Could not upload selfie. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const onRematch = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setError("Please sign in again");
        return;
      }
      const res = await fetch(
        `/api/face/profile?site=${encodeURIComponent(site)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "rematch" }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as ProfileResponse;
      if (!res.ok) {
        setError(data.error || "Could not refresh matches");
        return;
      }
      setProfile(data.profile || null);
      setMessage(data.message || "Matches updated");
      await load();
    } catch {
      setError("Could not refresh matches");
    } finally {
      setBusy(false);
    }
  };

  const downloadPhoto = async (photo: GalleryImage) => {
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
  };

  const downloadAll = async () => {
    for (const photo of photos) {
      await downloadPhoto(photo);
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  return (
    <section
      className={cn(
        "rounded-3xl border border-gold/20 bg-[#141018]/90 px-5 py-8 sm:px-8",
        className,
      )}
    >
      <div className="mb-6 flex flex-wrap items-start gap-3">
        <ScanFace className="mt-1 text-gold" size={22} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl text-cream sm:text-3xl">
            Find my photos
          </h2>
          <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-muted">
            Upload a clear selfie (or take one). We’ll match wedding photos so
            you can download yours. If nothing’s ready yet, we’ll email you when
            it is.
          </p>
        </div>
      </div>

      {!authReady ? (
        <p className="font-body text-sm text-muted">Checking sign-in…</p>
      ) : !user ? (
        <div className="max-w-md">
          <GuestAuthPanel
            onAuthed={setUser}
            title="Sign in to find your photos"
            subtitle="Use the same Google account you use for the gallery."
            ctaLabel="Continue with Google"
          />
        </div>
      ) : (
        <div className="space-y-6">
          {!rekognitionReady ? (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-body text-sm text-amber-100/90">
              Face matching isn’t fully configured on the server yet. You can
              still open this page — ask the family once AWS is connected.
            </p>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gold px-5 py-2.5 font-body text-sm font-medium text-[#1a1208] transition hover:bg-gold-soft disabled:opacity-60">
              <Camera size={16} />
              {busy ? "Working…" : profile ? "Update selfie" : "Upload selfie"}
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  e.target.value = "";
                  void onUpload(file);
                }}
              />
            </label>
            {profile?.selfieSrc ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void onRematch()}
                className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-4 py-2.5 font-body text-sm text-cream transition hover:border-gold/60"
              >
                <RefreshCw size={14} />
                Refresh matches
              </button>
            ) : null}
            <Link
              href="/my-photos"
              className="inline-flex items-center gap-2 rounded-full border border-cream/15 px-4 py-2.5 font-body text-sm text-muted transition hover:text-cream"
            >
              <Images size={14} />
              Open my album
            </Link>
          </div>

          {message ? (
            <p className="font-body text-sm text-gold-soft">{message}</p>
          ) : null}
          {error ? (
            <p className="font-body text-sm text-red-300/90">{error}</p>
          ) : null}

          {profile ? (
            <p className="font-body text-xs uppercase tracking-[0.2em] text-muted">
              {profile.matchCount} matched photo
              {profile.matchCount === 1 ? "" : "s"}
              {profile.lastMatchedAt
                ? ` · updated ${new Date(profile.lastMatchedAt).toLocaleString("en-IN")}`
                : ""}
            </p>
          ) : null}

          {photos.length > 0 ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void downloadAll()}
                  className="inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2.5 font-body text-sm font-medium text-[#1a1208]"
                >
                  <Download size={14} />
                  Download all ({photos.length})
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative aspect-square overflow-hidden rounded-2xl bg-black/40"
                  >
                    <Image
                      src={photo.src}
                      alt={photo.alt || "Matched photo"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                      unoptimized
                    />
                    <button
                      type="button"
                      onClick={() => void downloadPhoto(photo)}
                      className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1.5 font-body text-[10px] uppercase tracking-[0.14em] text-cream"
                    >
                      <Download size={12} />
                      Save
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : profile ? (
            <p className="font-body text-sm text-muted">
              No matches yet. We’ve queued your request
              {user.email ? ` for ${user.email}` : ""} — you’ll get an email when
              photos are ready. You can also tap Refresh matches later.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
