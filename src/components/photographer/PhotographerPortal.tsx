"use client";

import { upload } from "@vercel/blob/client";
import { Camera, CheckCircle2, LogOut, Upload } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Button } from "@/components/ui/Button";
import { sessionHasPermission } from "@/lib/client-session";
import type { AdminPermission, GalleryImage, ManagedEvent } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_FILES = 50;
const CONCURRENCY = 3;

type SessionInfo = {
  kind: "master" | "member";
  name: string;
  permissions: AdminPermission[];
};

type PreviewItem = {
  id: string;
  file: File;
  url: string;
  kind: GalleryImage["kind"];
};

function safeFilename(name: string) {
  return name.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 80) || "photo.jpg";
}

function mediaKind(file: File): GalleryImage["kind"] {
  return file.type.startsWith("video/") ? "video" : "image";
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]!, index);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    run(),
  );
  await Promise.all(runners);
  return results;
}

export function PhotographerPortal() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [events, setEvents] = useState<ManagedEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [doneCount, setDoneCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const canUpload = useMemo(
    () => Boolean(session && sessionHasPermission(session, "gallery_upload")),
    [session],
  );

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth", { cache: "no-store" });
      if (!res.ok) {
        setSession(null);
        return;
      }
      const data = (await res.json()) as { session?: SessionInfo };
      setSession(data.session || null);
    } catch {
      setSession(null);
    } finally {
      setAuthReady(true);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        events?: ManagedEvent[];
      };
      const list = data.events || [];
      setEvents(list);
      setEventId((current) => current || list[0]?.id || "");
    } catch {
      setEvents([]);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (canUpload) void loadEvents();
  }, [canUpload, loadEvents]);

  const onLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginBusy(true);
    setLoginError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim() || undefined,
          pin,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        session?: SessionInfo;
      };
      if (!res.ok || !data.session) {
        setLoginError(data.error || "Incorrect username or PIN");
        return;
      }
      if (!sessionHasPermission(data.session, "gallery_upload")) {
        setLoginError(
          "This account cannot upload photos. Ask the family for Photos Upload access.",
        );
        await fetch("/api/auth", { method: "DELETE" });
        setSession(null);
        return;
      }
      setSession(data.session);
      setPin("");
    } catch {
      setLoginError("Something went wrong");
    } finally {
      setLoginBusy(false);
    }
  };

  const onLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setSession(null);
    setPreviews((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    setDoneCount(0);
    setProgress("");
    setError("");
  };

  const onPickFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setError("");
    const available = MAX_FILES - previews.length;
    if (available <= 0) {
      setError(`You can select up to ${MAX_FILES} files at once`);
      return;
    }
    const incoming = Array.from(fileList).slice(0, available);
    if (fileList.length > available) {
      setError(`Maximum ${MAX_FILES} files — added the first ${available}`);
    }
    const next = incoming.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      kind: mediaKind(file),
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

  const onUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!eventId) {
      setError("Select an event for these photos");
      return;
    }
    if (!previews.length) {
      setError("Choose photos or videos to upload");
      return;
    }

    setUploading(true);
    setError("");
    setProgress(`Uploading 0 of ${previews.length}…`);
    let finished = 0;

    try {
      const media = await mapPool(previews, CONCURRENCY, async (item) => {
        const pathname = `gallery/photographer/${Date.now()}-${safeFilename(item.file.name)}`;
        const blob = await upload(pathname, item.file, {
          access: "public",
          handleUploadUrl: "/api/gallery/upload",
          multipart: item.kind === "video" || item.file.size > 4 * 1024 * 1024,
          contentType: item.file.type || undefined,
        });
        finished += 1;
        setProgress(`Uploading ${finished} of ${previews.length}…`);
        return {
          src: blob.url,
          alt: item.file.name.replace(/\.[^.]+$/, ""),
          aspect: "square" as const,
          kind: item.kind,
        };
      });

      setProgress("Saving to gallery…");
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          channel: "photographer",
          media,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        images?: GalleryImage[];
      };
      if (!res.ok) throw new Error(data.error || "Could not save media");

      setDoneCount((count) => count + (data.images?.length || media.length));
      clearPreviews();
      setProgress("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setProgress("");
    } finally {
      setUploading(false);
    }
  };

  if (!authReady) {
    return (
      <p className="text-center font-body text-sm text-muted">Checking access…</p>
    );
  }

  if (!session || !canUpload) {
    return (
      <form
        onSubmit={onLogin}
        className="mx-auto w-full max-w-md rounded-2xl border border-gold/25 bg-[#141018] p-8 shadow-[0_0_40px_-16px_rgba(212,175,55,0.35)]"
      >
        <p className="font-body text-[10px] uppercase tracking-[0.35em] text-gold/70">
          Photographer
        </p>
        <h1 className="mt-3 font-display text-3xl text-cream">Bulk upload</h1>
        <p className="mt-2 font-body text-sm text-muted">
          Sign in with the first-name username and PIN the family emailed you.
          Photos go live on the gallery after upload.
        </p>

        <label
          htmlFor="photo-username"
          className="mt-8 block font-body text-xs uppercase tracking-[0.2em] text-muted"
        >
          Username (first name)
        </label>
        <input
          id="photo-username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-4 py-3 font-body text-cream outline-none focus:border-gold/60"
          placeholder="e.g. Rahul"
          required
        />

        <label
          htmlFor="photo-pin"
          className="mt-5 block font-body text-xs uppercase tracking-[0.2em] text-muted"
        >
          PIN
        </label>
        <input
          id="photo-pin"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          className="mt-2 w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-4 py-3 font-body text-cream outline-none focus:border-gold/60"
          placeholder="••••••••"
          required
        />
        {loginError ? (
          <p className="mt-2 text-xs text-red-300">{loginError}</p>
        ) : null}

        <Button type="submit" disabled={loginBusy} className="mt-6 w-full">
          {loginBusy ? "Checking…" : "Open upload desk"}
        </Button>
      </form>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.28em] text-gold/70">
            Photographer desk
          </p>
          <h1 className="mt-2 font-display text-3xl text-cream sm:text-4xl">
            Upload wedding media
          </h1>
          <p className="mt-2 font-body text-sm text-muted">
            Signed in as <span className="text-cream">{session.name}</span>. Up
            to {MAX_FILES} files per batch — images or video. Goes live
            immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-4 py-2 font-body text-[11px] uppercase tracking-[0.18em] text-gold-soft transition hover:bg-gold/10"
        >
          <LogOut size={14} />
          Log out
        </button>
      </div>

      {doneCount > 0 ? (
        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 font-body text-sm text-emerald-100">
          <CheckCircle2 size={16} />
          {doneCount} file{doneCount === 1 ? "" : "s"} saved to the gallery this
          session.
        </div>
      ) : null}

      <form
        onSubmit={onUpload}
        className="space-y-5 rounded-2xl border border-gold/25 bg-[#141018] p-6 sm:p-8"
      >
        <label className="block">
          <span className="font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Event
          </span>
          <select
            value={eventId}
            onChange={(event) => setEventId(event.target.value)}
            className="mt-2 w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-4 py-3 font-body text-sm text-cream outline-none focus:border-gold/60"
            required
          >
            <option value="" disabled>
              Select event…
            </option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name} — {event.date}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Files ({previews.length}/{MAX_FILES})
            </p>
            {previews.length ? (
              <button
                type="button"
                onClick={clearPreviews}
                className="font-body text-[11px] uppercase tracking-[0.16em] text-muted hover:text-cream"
              >
                Clear
              </button>
            ) : null}
          </div>

          <label
            className={cn(
              "mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-gold/30 bg-[#0d0b10] px-6 py-10 text-center transition hover:border-gold/50 hover:bg-gold/5",
              previews.length >= MAX_FILES ? "pointer-events-none opacity-50" : "",
            )}
          >
            <Camera className="mb-3 text-gold/70" size={28} />
            <span className="font-display text-xl text-cream">
              Drop photos or tap to choose
            </span>
            <span className="mt-2 font-body text-xs text-muted">
              JPG, PNG, WEBP, GIF, MP4, WEBM, MOV
            </span>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
              multiple
              className="hidden"
              disabled={previews.length >= MAX_FILES || uploading}
              onChange={(event) => onPickFiles(event.target.files)}
            />
          </label>

          {previews.length ? (
            <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {previews.map((item) => (
                <li
                  key={item.id}
                  className="group relative overflow-hidden rounded-lg border border-gold/20 bg-black/40"
                >
                  {item.kind === "video" ? (
                    <video
                      src={item.url}
                      className="aspect-square h-full w-full object-cover"
                      muted
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url}
                      alt=""
                      className="aspect-square h-full w-full object-cover"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removePreview(item.id)}
                    className="absolute inset-x-0 bottom-0 bg-black/70 py-1 font-body text-[10px] uppercase tracking-wider text-cream opacity-0 transition group-hover:opacity-100"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {progress ? (
          <p className="font-body text-sm text-gold-soft">{progress}</p>
        ) : null}
        {error ? <p className="font-body text-sm text-red-300">{error}</p> : null}

        <Button
          type="submit"
          disabled={uploading || !previews.length || !eventId}
          className="w-full sm:w-auto"
        >
          <Upload size={15} />
          {uploading
            ? "Uploading…"
            : `Upload ${previews.length || ""} file${previews.length === 1 ? "" : "s"}`}
        </Button>
      </form>
    </div>
  );
}
