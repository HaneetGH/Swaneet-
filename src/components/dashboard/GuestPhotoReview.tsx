"use client";

import Image from "next/image";
import { Check, ClipboardCheck, ScanFace, X } from "lucide-react";
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
  const [faceBusy, setFaceBusy] = useState(false);
  const [faceStatus, setFaceStatus] = useState("");
  const [faceStats, setFaceStats] = useState<{
    indexed: number;
    failed: number;
    total: number;
    rekognitionReady: boolean;
    sampleErrors: string[];
  } | null>(null);

  useEffect(() => {
    setGallery(initialGallery);
  }, [initialGallery]);

  useEffect(() => {
    setEvents(initialEvents);
    if (!bulkEventId && initialEvents[0]?.id) {
      setBulkEventId(initialEvents[0].id);
    }
  }, [initialEvents, bulkEventId]);

  useEffect(() => {
    let alive = true;
    fetch("/api/face/reindex")
      .then((res) => res.json())
      .then((data) => {
        if (!alive || data.error) return;
        setFaceStats({
          indexed: data.indexed || 0,
          failed: data.failed || 0,
          total: data.total || 0,
          rekognitionReady: Boolean(data.rekognitionReady),
          sampleErrors: Array.isArray(data.sampleErrors)
            ? data.sampleErrors.map(String)
            : [],
        });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const onFaceReindex = async () => {
    setFaceBusy(true);
    setFaceStatus("");
    try {
      const res = await fetch("/api/face/reindex", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "missing", limit: 40 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFaceStatus(data.error || "Could not index faces");
        return;
      }
      const errors = Array.isArray(data.sampleErrors)
        ? data.sampleErrors.map(String)
        : [];
      setFaceStatus(
        errors.length
          ? `Indexed ${data.indexed || 0} · ${data.failed || 0} failed. ${errors[0]}`
          : `Indexed ${data.indexed || 0} of ${data.processed || 0} photo(s)${
              data.remaining ? ` · ${data.remaining} still waiting` : ""
            }.`,
      );
      const statusRes = await fetch("/api/face/reindex");
      if (statusRes.ok) {
        const status = await statusRes.json();
        setFaceStats({
          indexed: status.indexed || 0,
          failed: status.failed || 0,
          total: status.total || 0,
          rekognitionReady: Boolean(status.rekognitionReady),
          sampleErrors: Array.isArray(status.sampleErrors)
            ? status.sampleErrors.map(String)
            : errors,
        });
      }
    } catch {
      setFaceStatus("Could not index faces");
    } finally {
      setFaceBusy(false);
    }
  };

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

      <div className="mb-6 rounded-2xl border border-gold/20 bg-[#141018] p-4">
        <div className="flex flex-wrap items-start gap-3">
          <ScanFace className="mt-0.5 text-gold" size={18} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg text-cream">Face find index</p>
            <p className="mt-1 font-body text-xs leading-relaxed text-muted">
              Enable “Find my photos (face)” in Feature flags first. Then index
              approved gallery photos so guests can match a selfie. Approving a
              guest photo also indexes it automatically when AWS is configured.
            </p>
            {faceStats ? (
              <p className="mt-2 font-body text-[10px] uppercase tracking-[0.18em] text-gold-soft">
                {faceStats.indexed} indexed · {faceStats.failed} failed ·{" "}
                {faceStats.rekognitionReady
                  ? "AWS env set"
                  : "AWS not configured"}
              </p>
            ) : null}
            {faceStats?.sampleErrors?.length ? (
              <div className="mt-2 space-y-1 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 font-body text-xs text-red-200">
                <p className="font-semibold text-red-100">Why indexing failed</p>
                {faceStats.sampleErrors.map((err) => (
                  <p key={err} className="break-words">
                    {err}
                  </p>
                ))}
              </div>
            ) : null}
            {faceStatus ? (
              <p className="mt-2 font-body text-xs text-cream/80">{faceStatus}</p>
            ) : null}
            <Button
              type="button"
              className="mt-3"
              disabled={faceBusy || !faceStats?.rekognitionReady}
              onClick={() => void onFaceReindex()}
            >
              {faceBusy ? "Indexing…" : "Retry failed / missing faces"}
            </Button>
          </div>
        </div>
      </div>

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
