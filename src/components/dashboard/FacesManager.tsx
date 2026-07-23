"use client";

import { upload } from "@vercel/blob/client";
import Image from "next/image";
import { ArrowLeft, Link2, Merge, ScanFace, Undo2, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FaceBoundingBox } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

function safeFilename(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 80) || "face.jpg";
}

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

type RsvpSuggestion = {
  id: string;
  name: string;
  email: string;
  hasEmail?: boolean;
  attendance?: string;
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
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [canUndoMerge, setCanUndoMerge] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendName, setSendName] = useState("");
  const [selectedRsvpId, setSelectedRsvpId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<RsvpSuggestion[]>([]);
  const [sending, setSending] = useState(false);
  const [rsvpQuery, setRsvpQuery] = useState("");
  const [selfieBusy, setSelfieBusy] = useState(false);

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
      setCanUndoMerge(Boolean(data.canUndoMerge));
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
    setSelectedRsvpId(null);
    setSuggestions([]);
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
      const personName = (data.person?.name || "") as string;
      setNameDraft(personName);
      setSendName(personName);
      setRsvpQuery(personName);
      void searchRsvps(personName, true);
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
      if (data.merged && person?.id) {
        const note = `Merged with others named “${person.name || nameDraft}”`;
        await loadPeople();
        await openPerson(person.id);
        setMessage(note);
        setCanUndoMerge(true);
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

  const mergeSelected = async () => {
    if (mergeSelectedIds.length < 2 || merging) return;
    const labels = mergeSelectedIds.map((id) => {
      const row = people.find((p) => p.id === id);
      return row?.name || "Unnamed";
    });
    if (
      !confirm(
        `Merge ${mergeSelectedIds.length} faces into one person?\n\n${labels.join(", ")}\n\nThe system will remember they are the same person for future photos.`,
      )
    ) {
      return;
    }
    setMerging(true);
    setError("");
    try {
      const res = await fetch("/api/face/people", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          personIds: mergeSelectedIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not merge");
        return;
      }
      setMessage(
        `Merged ${mergeSelectedIds.length} faces into “${data.person?.name || "one person"}” — future matches will learn from this`,
      );
      setMergeMode(false);
      setMergeSelectedIds([]);
      setCanUndoMerge(true);
      await loadPeople();
    } catch {
      setError("Could not merge");
    } finally {
      setMerging(false);
    }
  };

  const undoMerge = async () => {
    if (!confirm("Undo the last face merge?")) return;
    setMerging(true);
    setError("");
    try {
      const res = await fetch("/api/face/people", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "undo_merge" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not undo");
        return;
      }
      setMessage("Last merge undone");
      setSelectedId(null);
      setAlbum(null);
      await loadPeople();
    } catch {
      setError("Could not undo");
    } finally {
      setMerging(false);
    }
  };

  const searchRsvps = async (query: string, autoSelectExact = false) => {
    setRsvpQuery(query);
    try {
      const res = await fetch("/api/face/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "rsvp_suggestions", query }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const list = (data.suggestions || []) as RsvpSuggestion[];
      setSuggestions(list);
      if (autoSelectExact && query.trim()) {
        const exact = list.find(
          (item) =>
            item.email &&
            item.name.trim().toLowerCase() === query.trim().toLowerCase(),
        );
        if (exact) {
          setSelectedRsvpId(exact.id);
          setSendEmail(exact.email);
          setSendName(exact.name);
        }
      }
    } catch {
      /* ignore */
    }
  };

  const sendLink = async (rsvpId?: string) => {
    if (!selectedId) return;
    const id = rsvpId || selectedRsvpId;
    if (!id && !sendEmail.trim()) {
      setError("Pick an RSVP guest (or enter their email)");
      return;
    }
    setSending(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/face/people", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_link",
          personId: selectedId,
          rsvpId: id || undefined,
          email: id ? undefined : sendEmail.trim(),
          name: sendName.trim() || nameDraft,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send email");
        return;
      }
      setMessage(
        `Photo link emailed to ${data.emailedTo || sendEmail.trim()}${
          data.guestName ? ` (${data.guestName})` : ""
        }`,
      );
    } catch {
      setError("Could not send email");
    } finally {
      setSending(false);
    }
  };

  const uploadSelfieAndSend = async (file: File | null) => {
    if (!file) return;
    setSelfieBusy(true);
    setError("");
    setMessage("");
    try {
      let selfieSrc: string | null = null;
      try {
        const pathname = `selfies/admin/${Date.now()}-${safeFilename(file.name)}`;
        const blob = await upload(pathname, file, {
          access: "public",
          handleUploadUrl: "/api/face/selfie/upload",
          contentType: file.type || "image/jpeg",
        });
        selfieSrc = blob.url;
      } catch {
        if (file.size > 4 * 1024 * 1024) {
          setError(
            "Photo is too large and Blob upload failed. Use a smaller image or connect Vercel Blob.",
          );
          return;
        }
      }

      const res = selfieSrc
        ? await fetch("/api/face/people", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              selfieSrc,
              name: sendName.trim() || nameDraft || "Guest",
              ...(selectedRsvpId
                ? { rsvpId: selectedRsvpId, send: true }
                : sendEmail.trim()
                  ? { email: sendEmail.trim(), send: true }
                  : {}),
            }),
          })
        : await fetch("/api/face/people", {
            method: "POST",
            body: (() => {
              const body = new FormData();
              body.append("selfie", file);
              body.append("name", sendName.trim() || nameDraft || "Guest");
              if (selectedRsvpId) {
                body.append("rsvpId", selectedRsvpId);
                body.append("send", "1");
              } else if (sendEmail.trim()) {
                body.append("email", sendEmail.trim());
                body.append("send", "1");
              }
              return body;
            })(),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not match selfie");
        return;
      }
      setMessage(
        data.emailed
          ? `Matched ${data.photoCount} photos and emailed ${data.emailedTo || sendEmail.trim()}`
          : `Matched ${data.photoCount} photos — pick an RSVP email to send`,
      );
      if (data.person?.id) {
        await loadPeople();
        await openPerson(data.person.id);
      }
    } catch {
      setError("Could not match selfie");
    } finally {
      setSelfieBusy(false);
    }
  };

  const onPersonClick = (id: string) => {
    if (!mergeMode) {
      void openPerson(id);
      return;
    }
    setMergeSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
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
                  Same name as another face merges them. Wrong merge? Use Undo
                  on the Faces list.
                </p>
              </div>
            </div>

            <div className="mb-6 rounded-2xl border border-gold/20 bg-[#141018] p-4">
              <p className="font-display text-lg text-cream">
                Email photos to RSVP guest
              </p>
              <p className="mt-1 font-body text-xs text-muted">
                Uses the email from their RSVP (or Google sign-in). They get a
                private album link for 14 days.
              </p>
              <label className="mt-3 block">
                <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                  Find RSVP guest
                </span>
                <input
                  className="w-full rounded-xl border border-gold/20 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none focus:border-gold/50"
                  value={rsvpQuery}
                  onChange={(e) => void searchRsvps(e.target.value)}
                  onFocus={() => void searchRsvps(rsvpQuery)}
                  placeholder="Search by RSVP name or email"
                />
              </label>
              {suggestions.length > 0 ? (
                <ul className="mt-2 max-h-48 overflow-auto rounded-xl border border-gold/15">
                  {suggestions.map((item) => {
                    const selected = selectedRsvpId === item.id;
                    const canSend = Boolean(item.email);
                    return (
                      <li
                        key={item.id}
                        className={cn(
                          "flex items-center gap-2 border-b border-gold/10 px-2 py-1.5 last:border-0",
                          selected && "bg-gold/10",
                        )}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left font-body text-xs text-cream"
                          onClick={() => {
                            if (!canSend) return;
                            setSelectedRsvpId(item.id);
                            setSendEmail(item.email);
                            setSendName(item.name);
                            setRsvpQuery(item.name);
                          }}
                        >
                          <span className="block truncate font-medium">
                            {item.name}
                          </span>
                          <span className="block truncate text-muted">
                            {canSend
                              ? item.email
                              : "No email on this RSVP"}
                          </span>
                        </button>
                        <Button
                          type="button"
                          disabled={sending || !canSend}
                          onClick={() => {
                            setSelectedRsvpId(item.id);
                            setSendEmail(item.email);
                            setSendName(item.name);
                            void sendLink(item.id);
                          }}
                        >
                          {sending && selectedRsvpId === item.id
                            ? "…"
                            : "Send"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 font-body text-[11px] text-muted">
                  No RSVP matches yet — search a name, or type an email below.
                </p>
              )}
              {selectedRsvpId && sendEmail ? (
                <p className="mt-2 font-body text-xs text-gold-soft">
                  Selected: {sendName} · {sendEmail}
                </p>
              ) : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-xl border border-gold/20 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none focus:border-gold/50"
                  value={sendName}
                  onChange={(e) => setSendName(e.target.value)}
                  placeholder="Guest name"
                />
                <input
                  type="email"
                  className="rounded-xl border border-gold/20 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none focus:border-gold/50"
                  value={sendEmail}
                  onChange={(e) => {
                    setSendEmail(e.target.value);
                    setSelectedRsvpId(null);
                  }}
                  placeholder="Or paste email manually"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={
                    sending || (!selectedRsvpId && !sendEmail.trim())
                  }
                  onClick={() => void sendLink()}
                >
                  {sending ? "Sending…" : "Send album to RSVP email"}
                </Button>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-gold/30 px-4 py-2 font-body text-[10px] uppercase tracking-[0.16em] text-gold-soft">
                  {selfieBusy ? "Matching…" : "Upload face + send"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={selfieBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      e.target.value = "";
                      void uploadSelfieAndSend(file);
                    }}
                  />
                </label>
              </div>
            </div>

            {message ? (
              <p className="mb-3 font-body text-xs text-gold-soft">{message}</p>
            ) : null}
            {error ? (
              <p className="mb-3 font-body text-xs text-red-300">{error}</p>
            ) : null}

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
                No photos linked yet. Index more gallery media, or upload a face
                photo above.
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
      <p className="mb-4 font-body text-sm text-muted">
        Tap someone to name them or email their album. Use Merge to select many
        duplicates at once — the system remembers they are the same person.
        Guests can self-serve at /my-photos.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={mergeMode ? "outline" : undefined}
          disabled={merging}
          onClick={() => {
            setMergeMode((v) => !v);
            setMergeSelectedIds([]);
            setMessage(
              mergeMode
                ? ""
                : "Merge mode: tap every face that is the same person, then Merge selected",
            );
          }}
        >
          <Merge size={14} className="mr-1.5" />
          {mergeMode ? "Cancel merge" : "Merge faces"}
        </Button>
        {mergeMode ? (
          <Button
            type="button"
            disabled={merging || mergeSelectedIds.length < 2}
            onClick={() => void mergeSelected()}
          >
            {merging
              ? "Merging…"
              : `Merge selected (${mergeSelectedIds.length})`}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          disabled={merging || !canUndoMerge}
          onClick={() => void undoMerge()}
        >
          <Undo2 size={14} className="mr-1.5" />
          Undo last merge
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const url = `${window.location.origin}/my-photos`;
            void navigator.clipboard.writeText(url).then(
              () => setMessage("Copied /my-photos link"),
              () => setMessage(url),
            );
          }}
        >
          <Link2 size={14} className="mr-1.5" />
          Copy guest link
        </Button>
      </div>

      {mergeMode ? (
        <p className="mb-3 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 font-body text-xs text-gold-soft">
          Tap all faces that are the same person ({mergeSelectedIds.length}{" "}
          selected). Then press Merge selected — future photos will learn from
          this.
        </p>
      ) : null}

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
            const selected = mergeSelectedIds.includes(person.id);
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => onPersonClick(person.id)}
                className={cn(
                  "rounded-2xl border bg-[#141018] p-3 text-left transition",
                  selected
                    ? "border-gold ring-2 ring-gold/50"
                    : mergeMode
                      ? "border-gold/40 hover:border-gold"
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
                  {selected ? " · selected" : ""}
                </p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
