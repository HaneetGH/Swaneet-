"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

/** Master: upload image shown on top of the homepage RSVP / stay banner */
export function RsvpBannerManager() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = () => {
    fetch("/api/site-banner")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { banner?: { imageUrl?: string } } | null) => {
        setImageUrl(data?.banner?.imageUrl || null);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/site-banner", {
        method: "POST",
        body,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        banner?: { imageUrl?: string };
      };
      if (!res.ok) {
        setMessage(data.error || "Could not upload banner image");
        return;
      }
      setImageUrl(data.banner?.imageUrl || null);
      setMessage("Banner image updated on the homepage.");
    } catch {
      setMessage("Could not upload banner image");
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (!confirm("Remove the RSVP banner image from the homepage?")) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/site-banner", { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage(data.error || "Could not remove image");
        return;
      }
      setImageUrl(null);
      setMessage("Banner image removed.");
    } catch {
      setMessage("Could not remove image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 rounded-2xl border border-gold/20 bg-[#141018] p-5">
      <div className="mb-4 flex items-center gap-2">
        <ImagePlus size={18} className="text-gold" />
        <div>
          <h3 className="font-display text-xl text-cream">RSVP banner image</h3>
          <p className="mt-1 font-body text-sm text-muted">
            Optional image shown above the “Need Accommodation?” shortcut under
            the hero.
          </p>
        </div>
      </div>

      {message ? (
        <p className="mb-4 rounded-xl border border-gold/25 bg-gold/10 px-3 py-2 font-body text-xs text-gold-soft">
          {message}
        </p>
      ) : null}

      {imageUrl ? (
        <div className="relative mb-4 aspect-[21/7] overflow-hidden rounded-xl border border-gold/20">
          <Image
            src={imageUrl}
            alt="RSVP banner preview"
            fill
            className="object-cover"
            sizes="600px"
            unoptimized={imageUrl.startsWith("/uploads/")}
          />
        </div>
      ) : (
        <p className="mb-4 rounded-xl border border-dashed border-gold/20 px-3 py-6 text-center font-body text-sm text-muted">
          No banner image yet — the shortcut still shows without one.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <label className="inline-flex cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              void onUpload(file);
              e.target.value = "";
            }}
          />
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft px-5 py-2.5 font-body text-xs uppercase tracking-[0.18em] text-[#1a1208]">
            <ImagePlus size={14} />
            {busy ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
          </span>
        </label>
        {imageUrl ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 size={14} />
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
