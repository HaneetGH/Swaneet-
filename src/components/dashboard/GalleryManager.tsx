"use client";

import Image from "next/image";
import { Images, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GalleryImage } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const MAX_FILES = 10;

type PreviewItem = {
  id: string;
  file: File;
  url: string;
};

type GalleryManagerProps = {
  initialGallery: GalleryImage[];
};

export function GalleryManager({ initialGallery }: GalleryManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState(initialGallery);
  const [alt, setAlt] = useState("");
  const [aspect, setAspect] = useState<"portrait" | "landscape" | "square">(
    "square",
  );
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    return () => {
      previews.forEach((item) => URL.revokeObjectURL(item.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;

    const incoming = Array.from(list).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!incoming.length) {
      setError("Please choose image files only");
      return;
    }

    const available = MAX_FILES - previews.length;
    if (available <= 0) {
      setError(`You can select up to ${MAX_FILES} images at once`);
      return;
    }

    const accepted = incoming.slice(0, available);
    if (incoming.length > available) {
      setError(`Maximum ${MAX_FILES} images — added the first ${available}`);
    } else {
      setError("");
    }

    const next = accepted.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
    }));
    setPreviews((prev) => [...prev, ...next]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removePreview = (id: string) => {
    setPreviews((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearPreviews = () => {
    previews.forEach((item) => URL.revokeObjectURL(item.url));
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previews.length) {
      setError("Choose at least one image to upload");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const body = new FormData();
      previews.forEach((item) => body.append("files", item.file));
      body.append("alt", alt);
      body.append("aspect", aspect);

      const res = await fetch("/api/gallery", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      setGallery((prev) => [...(data.images as GalleryImage[]), ...prev]);
      setAlt("");
      clearPreviews();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Remove this image from the gallery?")) return;
    const res = await fetch(`/api/gallery/${id}`, { method: "DELETE" });
    if (res.ok) setGallery((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <form
        onSubmit={onUpload}
        className="rounded-2xl border border-gold/20 bg-[#141018] p-5"
      >
        <div className="mb-2 flex items-center gap-2">
          <Images size={18} className="text-gold" />
          <h2 className="font-display text-2xl text-cream">
            Multi-image upload
          </h2>
        </div>
        <p className="mb-5 font-body text-sm text-muted">
          Choose up to <span className="text-gold-soft">{MAX_FILES} images</span>{" "}
          at once, then upload them together.
        </p>

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "rounded-2xl border border-dashed bg-[#0d0b10] px-4 py-8 text-center transition",
            dragging ? "border-gold bg-gold/10" : "border-gold/30",
          )}
        >
          <Upload className="mx-auto mb-3 text-gold/70" size={32} />
          <p className="font-display text-xl text-cream">
            Drop multiple images here
          </p>
          <p className="mt-2 font-body text-xs text-muted">
            or use the button below · JPG, PNG, WEBP, GIF · max 8MB each
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={previews.length >= MAX_FILES}
            >
              <Images size={16} />
              Select multiple images
            </Button>
            <p className="font-body text-xs tracking-wide text-gold-soft">
              {previews.length} of {MAX_FILES} selected
            </p>
          </div>

          {/* Visible native multi-file control for clarity */}
          <div className="mx-auto mt-5 max-w-md text-left">
            <label
              htmlFor="multi-image-input"
              className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted"
            >
              File picker (multiple enabled)
            </label>
            <input
              id="multi-image-input"
              ref={inputRef}
              type="file"
              name="files"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="block w-full cursor-pointer rounded-xl border border-gold/25 bg-[#141018] px-3 py-2.5 font-body text-xs text-cream file:mr-3 file:rounded-full file:border-0 file:bg-gold/20 file:px-3 file:py-1.5 file:font-body file:text-xs file:text-gold-soft"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
        </div>

        {previews.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-body text-xs uppercase tracking-[0.2em] text-muted">
                Ready to upload
              </p>
              <button
                type="button"
                onClick={clearPreviews}
                className="font-body text-xs text-gold-soft hover:text-gold"
              >
                Clear all
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {previews.map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-gold/20 bg-[#0d0b10]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.file.name}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePreview(item.id)}
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-cream"
                    aria-label={`Remove ${item.file.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <label className="mt-4 block">
          <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Caption prefix (optional)
          </span>
          <input
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Applied to all selected images"
            className="w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none focus:border-gold/60"
          />
        </label>

        <label className="mt-4 block">
          <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Aspect
          </span>
          <select
            value={aspect}
            onChange={(e) =>
              setAspect(e.target.value as "portrait" | "landscape" | "square")
            }
            className="w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none [color-scheme:dark] focus:border-gold/60"
          >
            <option value="square">Square</option>
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>

        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}

        <Button
          type="submit"
          disabled={uploading || !previews.length}
          className="mt-5 w-full"
        >
          {uploading
            ? `Uploading ${previews.length} images…`
            : previews.length
              ? `Upload ${previews.length} image${previews.length === 1 ? "" : "s"}`
              : "Select images to upload"}
        </Button>
      </form>

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-2xl text-cream">Gallery</h3>
          <span className="font-body text-xs text-muted">{gallery.length} images</span>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {gallery.map((image) => (
            <div
              key={image.id}
              className={cn(
                "group relative overflow-hidden rounded-xl border border-gold/20 bg-[#0d0b10]",
                image.aspect === "portrait" && "aspect-[3/4]",
                image.aspect === "landscape" && "aspect-[4/3]",
                image.aspect === "square" && "aspect-square",
              )}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-cover"
                sizes="200px"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="truncate font-body text-[10px] text-cream/90">
                  {image.alt}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(image.id)}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-2 text-red-200 opacity-0 transition group-hover:opacity-100"
                aria-label={`Delete ${image.alt}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        {gallery.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
            No gallery images yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
