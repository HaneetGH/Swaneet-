"use client";

import Image from "next/image";
import { Check, ClipboardCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { GalleryImage, ManagedEvent } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type GuestPhotoReviewProps = {
  initialGallery: GalleryImage[];
  events: ManagedEvent[];
};

export function GuestPhotoReview({
  initialGallery,
  events: initialEvents,
}: GuestPhotoReviewProps) {
  const [gallery, setGallery] = useState(initialGallery);
  const [events, setEvents] = useState(initialEvents);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkEventId, setBulkEventId] = useState(initialEvents[0]?.id || "");
  const [moderating, setModerating] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  useEffect(() => {
    setGallery(initialGallery);
  }, [initialGallery]);

  useEffect(() => {
    setEvents(initialEvents);
    if (!bulkEventId && initialEvents[0]?.id) {
      setBulkEventId(initialEvents[0].id);
    }
  }, [initialEvents, bulkEventId]);

  const eventNameById = useMemo(() => {
    return new Map(events.map((event) => [event.id, event.name]));
  }, [events]);

  const pendingGuest = useMemo(
    () => gallery.filter((image) => image.status === "pending"),
    [gallery],
  );

  const selectedPending = useMemo(
    () => selectedIds.filter((id) => pendingGuest.some((img) => img.id === id)),
    [selectedIds, pendingGuest],
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const onBulkModerate = async (action: "approve" | "reject" | "assign") => {
    const ids = selectedPending;
    if (!ids.length) {
      setError("Select at least one guest photo");
      return;
    }
    if ((action === "approve" || action === "assign") && !bulkEventId) {
      setError("Choose an event first");
      return;
    }

    setModerating(true);
    setError("");
    setProgress("");
    try {
      const res = await fetch("/api/gallery/moderate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids,
          action,
          eventId: bulkEventId || "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        count?: number;
        emailed?: number;
        emailFailed?: number;
        images?: GalleryImage[];
      };
      if (!res.ok) {
        setError(data.error || "Could not update photos");
        return;
      }

      if (action === "reject") {
        setGallery((prev) => prev.filter((item) => !ids.includes(item.id)));
        setProgress(
          `Rejected ${data.count ?? ids.length} · emailed ${data.emailed ?? 0}${
            data.emailFailed ? ` · ${data.emailFailed} email failed` : ""
          }`,
        );
      } else if (data.images) {
        const map = new Map(data.images.map((image) => [image.id, image]));
        setGallery((prev) => prev.map((item) => map.get(item.id) || item));
        setProgress(
          action === "approve"
            ? `Approved ${data.count ?? ids.length} photo(s)`
            : `Assigned ${data.count ?? ids.length} photo(s) to event`,
        );
      }
      setSelectedIds([]);
    } catch {
      setError("Could not update photos");
    } finally {
      setModerating(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <ClipboardCheck size={18} className="text-gold" />
        <h2 className="font-display text-2xl text-cream">
          Review guest photos
        </h2>
      </div>
      <p className="mb-6 font-body text-sm text-muted">
        Approve, reject, or assign an event. Rejected guests get a sorry email.
        Team uploads (no approval) are under Upload media.
      </p>

      {error ? <p className="mb-3 text-xs text-red-300">{error}</p> : null}
      {progress ? (
        <p className="mb-3 text-xs text-gold-soft">{progress}</p>
      ) : null}

      {pendingGuest.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
          No guest photos waiting for review.
        </p>
      ) : (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="font-display text-xl text-cream">Pending</h3>
            <span className="font-body text-[10px] uppercase tracking-[0.2em] text-amber-100/80">
              {pendingGuest.length} pending · {selectedPending.length} selected
            </span>
          </div>

          <div className="mb-4 space-y-3 rounded-xl border border-gold/15 bg-[#0d0b10]/80 p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(pendingGuest.map((image) => image.id))
                }
                className="rounded-full border border-gold/25 px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-gold-soft"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-full border border-gold/15 px-3 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted"
              >
                Clear
              </button>
            </div>
            <label className="block">
              <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                Event for selected
              </span>
              <select
                value={bulkEventId}
                onChange={(e) => setBulkEventId(e.target.value)}
                className="w-full rounded-lg border border-gold/20 bg-[#141018] px-2 py-2 font-body text-xs text-cream [color-scheme:dark]"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={moderating || !selectedPending.length}
                onClick={() => void onBulkModerate("approve")}
                className="min-w-[7rem] flex-1"
              >
                <Check size={14} />
                Approve
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={moderating || !selectedPending.length}
                onClick={() => void onBulkModerate("assign")}
                className="min-w-[7rem] flex-1"
              >
                Assign event
              </Button>
              <button
                type="button"
                disabled={moderating || !selectedPending.length}
                onClick={() => {
                  if (
                    confirm(
                      `Reject ${selectedPending.length} photo(s)? Guests will get a sorry email.`,
                    )
                  ) {
                    void onBulkModerate("reject");
                  }
                }}
                className="flex min-w-[7rem] flex-1 items-center justify-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2.5 font-body text-xs uppercase tracking-[0.18em] text-red-200 disabled:opacity-50"
              >
                <X size={14} />
                Reject
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {pendingGuest.map((image) => {
              const selected = selectedIds.includes(image.id);
              const assignedName =
                eventNameById.get(image.eventId) || "No event";
              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => toggleSelected(image.id)}
                  className={cn(
                    "overflow-hidden rounded-xl border bg-[#0d0b10] text-left transition",
                    selected
                      ? "border-gold ring-1 ring-gold/40"
                      : "border-gold/20",
                  )}
                >
                  <div className="relative aspect-square">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      className="object-cover"
                      sizes="200px"
                    />
                    <span
                      className={cn(
                        "absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border text-[10px]",
                        selected
                          ? "border-gold bg-gold text-[#1a1208]"
                          : "border-cream/40 bg-black/50 text-cream",
                      )}
                    >
                      {selected ? "✓" : ""}
                    </span>
                  </div>
                  <div className="space-y-1 p-2">
                    <p className="truncate font-body text-[10px] text-muted">
                      {image.uploadedByName ||
                        image.uploadedByEmail ||
                        "Guest"}
                    </p>
                    <p className="truncate font-body text-[10px] text-gold-soft">
                      {assignedName}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
