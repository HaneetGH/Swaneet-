"use client";

import { upload } from "@vercel/blob/client";
import Image from "next/image";
import { Film, Images, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GalleryImage, ManagedEvent } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const MAX_FILES = 10;
const MAX_LOCAL_BYTES = 8 * 1024 * 1024;
const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

type PreviewItem = {
  id: string;
  file: File;
  url: string;
  kind: "image" | "video";
};

type GalleryManagerProps = {
  initialGallery: GalleryImage[];
  events: ManagedEvent[];
};

function isVideoFile(file: File) {
  return file.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(file.name);
}

function safeFilename(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 80) || "media";
}

export function GalleryManager({
  initialGallery,
  events,
}: GalleryManagerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [gallery, setGallery] = useState(initialGallery);
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [filterEventId, setFilterEventId] = useState<string>("all");
  const [alt, setAlt] = useState("");
  const [aspect, setAspect] = useState<"portrait" | "landscape" | "square">(
    "square",
  );
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [dragging, setDragging] = useState(false);
  const [hasBlob, setHasBlob] = useState<boolean | null>(null);

  useEffect(() => {
    if (!eventId && events[0]?.id) setEventId(events[0].id);
  }, [eventId, events]);

  useEffect(() => {
    fetch("/api/storage")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { hasBlobStorage?: boolean } | null) => {
        setHasBlob(Boolean(data?.hasBlobStorage));
      })
      .catch(() => setHasBlob(false));
  }, []);

  useEffect(() => {
    return () => {
      previews.forEach((item) => URL.revokeObjectURL(item.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eventNameById = useMemo(() => {
    return new Map(events.map((event) => [event.id, event.name]));
  }, [events]);

  const filteredGallery = useMemo(() => {
    if (filterEventId === "all") return gallery;
    if (filterEventId === "unassigned") {
      return gallery.filter((image) => !image.eventId);
    }
    return gallery.filter((image) => image.eventId === filterEventId);
  }, [filterEventId, gallery]);

  const groupedGallery = useMemo(() => {
    const groups: { key: string; title: string; images: GalleryImage[] }[] = [];
    const byEvent = new Map<string, GalleryImage[]>();

    for (const image of filteredGallery) {
      const key = image.eventId || "unassigned";
      const list = byEvent.get(key) || [];
      list.push(image);
      byEvent.set(key, list);
    }

    for (const event of events) {
      const images = byEvent.get(event.id);
      if (images?.length) {
        groups.push({ key: event.id, title: event.name, images });
        byEvent.delete(event.id);
      }
    }

    const unassigned = byEvent.get("unassigned");
    if (unassigned?.length) {
      groups.push({
        key: "unassigned",
        title: "Unassigned",
        images: unassigned,
      });
    }

    for (const [key, images] of byEvent) {
      if (key === "unassigned") continue;
      groups.push({
        key,
        title: eventNameById.get(key) || "Other",
        images,
      });
    }

    return groups;
  }, [events, eventNameById, filteredGallery]);

  const addFiles = (list: FileList | File[] | null) => {
    if (!list) return;

    const incoming = Array.from(list).filter(
      (file) =>
        file.type.startsWith("image/") ||
        file.type.startsWith("video/") ||
        /\.(jpe?g|png|webp|gif|mp4|webm|mov)$/i.test(file.name),
    );
    if (!incoming.length) {
      setError("Please choose image or video files only");
      return;
    }

    const available = MAX_FILES - previews.length;
    if (available <= 0) {
      setError(`You can select up to ${MAX_FILES} files at once`);
      return;
    }

    const accepted = incoming.slice(0, available);
    if (incoming.length > available) {
      setError(`Maximum ${MAX_FILES} files — added the first ${available}`);
    } else {
      setError("");
    }

    const next = accepted.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      kind: isVideoFile(file) ? ("video" as const) : ("image" as const),
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

  const uploadViaBlob = async () => {
    const media: Array<{
      src: string;
      alt: string;
      aspect: GalleryImage["aspect"];
      kind: GalleryImage["kind"];
    }> = [];

    for (const [index, item] of previews.entries()) {
      setProgress(`Uploading ${index + 1} of ${previews.length}…`);
      const pathname = `gallery/${Date.now()}-${safeFilename(item.file.name)}`;
      const blob = await upload(pathname, item.file, {
        access: "public",
        handleUploadUrl: "/api/gallery/upload",
        multipart: item.kind === "video" || item.file.size > 4 * 1024 * 1024,
        contentType: item.file.type || undefined,
      });

      media.push({
        src: blob.url,
        alt:
          previews.length === 1
            ? alt
            : alt
              ? `${alt} (${index + 1})`
              : item.file.name.replace(/\.[^.]+$/, ""),
        aspect,
        kind: item.kind,
      });
    }

    setProgress("Saving to gallery…");
    const res = await fetch("/api/gallery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, media }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save media");
    return data.images as GalleryImage[];
  };

  const uploadViaFormData = async () => {
    if (previews.some((item) => item.kind === "video")) {
      throw new Error(
        "Videos need Vercel Blob. Connect Blob in Vercel → Storage, redeploy, then upload again.",
      );
    }
    if (previews.some((item) => item.file.size > MAX_LOCAL_BYTES)) {
      throw new Error(
        "Files over 8MB need Vercel Blob. Connect Blob in Storage, then retry.",
      );
    }

    const body = new FormData();
    previews.forEach((item) => body.append("files", item.file));
    body.append("eventId", eventId);
    body.append("alt", alt);
    body.append("aspect", aspect);

    const res = await fetch("/api/gallery", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Upload failed");
    return data.images as GalleryImage[];
  };

  const onUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) {
      setError("Select an event for these photos");
      return;
    }
    if (!previews.length) {
      setError("Choose at least one image or video to upload");
      return;
    }

    setUploading(true);
    setError("");
    setProgress("");
    try {
      const images =
        hasBlob === false ? await uploadViaFormData() : await uploadViaBlob();
      setGallery((prev) => [...images, ...prev]);
      setFilterEventId(eventId);
      setAlt("");
      clearPreviews();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Upload failed";
      // If Blob route missing, fall back once for small images
      if (
        hasBlob !== false &&
        /Blob storage is not connected|503|not configured/i.test(message) &&
        previews.every((item) => item.kind === "image")
      ) {
        try {
          const images = await uploadViaFormData();
          setGallery((prev) => [...images, ...prev]);
          setFilterEventId(eventId);
          setAlt("");
          clearPreviews();
          setHasBlob(false);
          return;
        } catch (fallbackErr) {
          setError(
            fallbackErr instanceof Error ? fallbackErr.message : "Upload failed",
          );
          return;
        }
      }
      setError(message);
    } finally {
      setUploading(false);
      setProgress("");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Remove this item from the gallery?")) return;
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
            Event media upload
          </h2>
        </div>
        <p className="mb-5 font-body text-sm text-muted">
          Pick an event, then upload up to{" "}
          <span className="text-gold-soft">{MAX_FILES} photos or videos</span>.
          Videos upload directly to Blob (required on Vercel).
        </p>

        {hasBlob === false ? (
          <p className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 font-body text-xs text-amber-100">
            Blob is not connected — images under 8MB still work locally. For
            videos and larger files, connect Blob in Vercel → Storage.
          </p>
        ) : null}

        <label className="mb-4 block">
          <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Event
          </span>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            required
            className="w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none [color-scheme:dark] focus:border-gold/60"
          >
            {events.length === 0 ? (
              <option value="">No events yet — create one first</option>
            ) : (
              events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))
            )}
          </select>
        </label>

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
            Drop photos or videos here
          </p>
          <p className="mt-2 font-body text-xs text-muted">
            JPG, PNG, WEBP, GIF, MP4, WEBM, MOV · videos up to 100MB with Blob
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            <Button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={previews.length >= MAX_FILES || !events.length}
            >
              <Images size={16} />
              Select files
            </Button>
            <p className="font-body text-xs tracking-wide text-gold-soft">
              {previews.length} of {MAX_FILES} selected
            </p>
          </div>

          <div className="mx-auto mt-5 max-w-md text-left">
            <label
              htmlFor="multi-media-input"
              className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted"
            >
              File picker
            </label>
            <input
              id="multi-media-input"
              ref={inputRef}
              type="file"
              name="files"
              accept={ACCEPT}
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
                  {item.kind === "video" ? (
                    <video
                      src={item.url}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {item.kind === "video" ? (
                    <span className="absolute left-1 top-1 rounded-full bg-black/70 p-1 text-gold-soft">
                      <Film size={12} />
                    </span>
                  ) : null}
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
            placeholder="Applied to all selected files"
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
        {progress ? (
          <p className="mt-3 text-xs text-gold-soft">{progress}</p>
        ) : null}

        <Button
          type="submit"
          disabled={uploading || !previews.length || !eventId}
          className="mt-5 w-full"
        >
          {uploading
            ? progress || `Uploading ${previews.length} files…`
            : previews.length
              ? `Upload ${previews.length} file${previews.length === 1 ? "" : "s"}`
              : "Select files to upload"}
        </Button>
      </form>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-2xl text-cream">Gallery</h3>
          <span className="font-body text-xs text-muted">
            {filteredGallery.length} items
          </span>
        </div>

        <div className="mb-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilterEventId("all")}
            className={cn(
              "rounded-full border px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] transition",
              filterEventId === "all"
                ? "border-gold bg-gold/15 text-gold-soft"
                : "border-gold/20 text-muted hover:text-cream",
            )}
          >
            All
          </button>
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => setFilterEventId(event.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] transition",
                filterEventId === event.id
                  ? "border-gold bg-gold/15 text-gold-soft"
                  : "border-gold/20 text-muted hover:text-cream",
              )}
            >
              {event.name}
            </button>
          ))}
        </div>

        {groupedGallery.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
            No gallery media yet for this filter.
          </p>
        ) : (
          <div className="space-y-8">
            {groupedGallery.map((group) => (
              <div key={group.key}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h4 className="font-display text-xl text-cream">
                    {group.title}
                  </h4>
                  <span className="font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                    {group.images.length} items
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                  {group.images.map((image) => (
                    <div
                      key={image.id}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border border-gold/20 bg-[#0d0b10]",
                        image.aspect === "portrait" && "aspect-[3/4]",
                        image.aspect === "landscape" && "aspect-[4/3]",
                        image.aspect === "square" && "aspect-square",
                      )}
                    >
                      {image.kind === "video" ? (
                        <video
                          src={image.src}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                      ) : (
                        <Image
                          src={image.src}
                          alt={image.alt}
                          fill
                          className="object-cover"
                          sizes="200px"
                        />
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="truncate font-body text-[10px] text-cream/90">
                          {image.kind === "video" ? "Video · " : ""}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
