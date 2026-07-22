"use client";

import Image from "next/image";
import { ArrowLeft, ScanFace, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FaceBoundingBox } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type PersonRow = {
  id: string;
  name: string;
  photoCount: number;
  faceCount: number;
  updatedAt: string;
  preview: {
    imageId: string;
    src: string;
    alt: string;
    boundingBox?: FaceBoundingBox;
  } | null;
};

type PersonAlbum = {
  person: {
    id: string;
    name: string;
    imageIds: string[];
    faceIds: string[];
  };
  preview: PersonRow["preview"];
  photos: Array<{
    id: string;
    src: string;
    alt: string;
    eventId?: string;
    faces: Array<{ faceId: string; boundingBox: FaceBoundingBox }>;
  }>;
};

function FaceCrop({
  src,
  alt,
  box,
  className,
}: {
  src: string;
  alt: string;
  box?: FaceBoundingBox;
  className?: string;
}) {
  if (!box || box.width <= 0 || box.height <= 0) {
    return (
      <div className={cn("relative overflow-hidden bg-black/40", className)}>
        <Image src={src} alt={alt} fill className="object-cover" unoptimized />
      </div>
    );
  }

  const widthPct = 100 / box.width;
  const heightPct = 100 / box.height;
  const leftPct = (-box.left / box.width) * 100;
  const topPct = (-box.top / box.height) * 100;

  return (
    <div className={cn("relative overflow-hidden bg-black/40", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="absolute max-w-none"
        style={{
          width: `${widthPct}%`,
          height: `${heightPct}%`,
          left: `${leftPct}%`,
          top: `${topPct}%`,
        }}
      />
    </div>
  );
}

export function FacesManager() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [album, setAlbum] = useState<PersonAlbum | null>(null);
  const [albumLoading, setAlbumLoading] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  const loadPeople = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/face/people", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load faces");
        return;
      }
      setPeople(data.people || []);
    } catch {
      setError("Could not load faces");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPeople();
  }, [loadPeople]);

  const openPerson = async (id: string) => {
    setSelectedId(id);
    setAlbumLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/face/people/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load album");
        setAlbum(null);
        return;
      }
      setAlbum(data as PersonAlbum);
      setNameDraft(data.person?.name || "");
    } catch {
      setError("Could not load album");
      setAlbum(null);
    } finally {
      setAlbumLoading(false);
    }
  };

  const saveName = async () => {
    if (!selectedId) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/face/people", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedId, name: nameDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save name");
        return;
      }
      const person = data.person as { id: string; name: string } | undefined;
      const merged = Boolean(data.merged);
      if (merged && person?.id) {
        const note = `Merged with others named “${person.name || nameDraft}” — photos combined.`;
        await loadPeople();
        await openPerson(person.id);
        setMessage(note);
        return;
      }
      setMessage("Name saved");
      setAlbum((prev) =>
        prev
          ? {
              ...prev,
              person: { ...prev.person, name: person?.name || nameDraft },
            }
          : prev,
      );
      setPeople((prev) =>
        prev.map((row) =>
          row.id === selectedId
            ? { ...row, name: person?.name || nameDraft }
            : row,
        ),
      );
    } catch {
      setError("Could not save name");
    } finally {
      setSaving(false);
    }
  };

  const mergePeople = async (sourceId: string, targetId: string) => {
    if (sourceId === targetId || merging) return;
    const source = people.find((p) => p.id === sourceId);
    const target = people.find((p) => p.id === targetId);
    const sourceLabel = source?.name || "Unnamed";
    const targetLabel = target?.name || "Unnamed";
    if (
      !confirm(
        `Merge “${sourceLabel}” into “${targetLabel}”? Photos will combine under one person.`,
      )
    ) {
      return;
    }

    setMerging(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/face/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId, targetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not merge");
        return;
      }
      setMessage(`Merged into “${data.person?.name || targetLabel}”`);
      await loadPeople();
    } catch {
      setError("Could not merge");
    } finally {
      setMerging(false);
      setDragId(null);
      setDropTargetId(null);
    }
  };

  if (selectedId) {
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            setSelectedId(null);
            setAlbum(null);
            setMessage("");
          }}
          className="mb-5 inline-flex items-center gap-2 font-body text-xs uppercase tracking-[0.2em] text-muted hover:text-gold-soft"
        >
          <ArrowLeft size={14} />
          All faces
        </button>

        {albumLoading || !album ? (
          <p className="font-body text-sm text-muted">Loading album…</p>
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-start gap-4">
              {album.preview ? (
                <FaceCrop
                  src={album.preview.src}
                  alt={album.preview.alt}
                  box={album.preview.boundingBox}
                  className="h-24 w-24 rounded-2xl border border-gold/20"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border border-gold/20 bg-[#141018]">
                  <UserRound className="text-gold/50" size={28} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-2xl text-cream">
                  {album.person.name || "Unnamed person"}
                </h2>
                <p className="mt-1 font-body text-xs text-muted">
                  {album.photos.length} photo
                  {album.photos.length === 1 ? "" : "s"} ·{" "}
                  {album.person.faceIds.length} face detection
                  {album.person.faceIds.length === 1 ? "" : "s"}
                </p>
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  <label className="block min-w-[200px] flex-1">
                    <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                      Name this person
                    </span>
                    <input
                      className="w-full rounded-xl border border-gold/20 bg-[#141018] px-3 py-2.5 font-body text-sm text-cream outline-none focus:border-gold/50"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder="e.g. Uncle Raj"
                    />
                  </label>
                  <Button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveName()}
                  >
                    {saving ? "Saving…" : "Save name"}
                  </Button>
                </div>
                <p className="mt-2 font-body text-[11px] text-muted">
                  Same name as another face merges them into one person.
                </p>
                {message ? (
                  <p className="mt-2 font-body text-xs text-gold-soft">
                    {message}
                  </p>
                ) : null}
                {error ? (
                  <p className="mt-2 font-body text-xs text-red-300">{error}</p>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {album.photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-2xl border border-gold/15 bg-black/30"
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt || "Photo"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    unoptimized
                  />
                </div>
              ))}
            </div>
            {album.photos.length === 0 ? (
              <p className="font-body text-sm text-muted">
                No photos linked yet. Index more gallery media.
              </p>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <ScanFace size={18} className="text-gold" />
        <h2 className="font-display text-2xl text-cream">Faces</h2>
      </div>
      <p className="mb-6 font-body text-sm text-muted">
        Every detected person from indexed photos. Drag one face onto another to
        merge duplicates, or open someone and give both the same name.
      </p>

      {error ? <p className="mb-3 text-xs text-red-300">{error}</p> : null}
      {message ? (
        <p className="mb-3 text-xs text-gold-soft">{message}</p>
      ) : null}

      {loading ? (
        <p className="font-body text-sm text-muted">Loading faces…</p>
      ) : people.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
          No faces yet. Upload or approve photos, then run Index missing faces.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {people.map((person) => {
            const isDropTarget =
              dropTargetId === person.id && dragId && dragId !== person.id;
            return (
              <button
                key={person.id}
                type="button"
                draggable={!merging}
                onDragStart={(e) => {
                  setDragId(person.id);
                  e.dataTransfer.setData("text/plain", person.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragId(null);
                  setDropTargetId(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragId && dragId !== person.id) {
                    setDropTargetId(person.id);
                  }
                }}
                onDragLeave={() => {
                  setDropTargetId((prev) =>
                    prev === person.id ? null : prev,
                  );
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const sourceId =
                    e.dataTransfer.getData("text/plain") || dragId;
                  setDropTargetId(null);
                  setDragId(null);
                  if (sourceId && sourceId !== person.id) {
                    void mergePeople(sourceId, person.id);
                  }
                }}
                onClick={() => {
                  if (dragId) return;
                  void openPerson(person.id);
                }}
                className={cn(
                  "rounded-2xl border bg-[#141018] p-3 text-left transition",
                  isDropTarget
                    ? "border-gold scale-[1.02] border-gold/70 ring-2 ring-gold/40"
                    : dragId === person.id
                      ? "border-gold/30 opacity-50"
                      : "border-gold/15 hover:border-gold/40",
                )}
              >
                {person.preview ? (
                  <FaceCrop
                    src={person.preview.src}
                    alt={person.preview.alt}
                    box={person.preview.boundingBox}
                    className="mb-3 aspect-square w-full rounded-xl"
                  />
                ) : (
                  <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-xl bg-black/30">
                    <UserRound className="text-gold/40" size={28} />
                  </div>
                )}
                <p className="truncate font-display text-lg text-cream">
                  {person.name || "Unnamed"}
                </p>
                <p className="font-body text-[10px] uppercase tracking-[0.16em] text-muted">
                  {person.photoCount} photo
                  {person.photoCount === 1 ? "" : "s"}
                  {isDropTarget ? " · drop to merge" : ""}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
