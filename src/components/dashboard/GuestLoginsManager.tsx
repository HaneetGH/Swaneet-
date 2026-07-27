"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Images,
  LogIn,
  MessageSquare,
  RefreshCw,
  Search,
  UserRound,
} from "lucide-react";
import type {
  GuestActivityAction,
  GuestActivityEntry,
  GuestProfile,
} from "@/lib/types";
import {
  inviteSourceBadge,
  inviteSourceDetail,
  sourceBadgeClass,
} from "@/lib/invite-source";
import { cn } from "@/lib/utils";

type ActivityFilter =
  | "all"
  | "rsvp"
  | "stay"
  | "photos"
  | "gallery"
  | "downloads"
  | "query";

const ACTION_LABEL: Record<GuestActivityAction, string> = {
  login: "Signed in",
  gallery_view: "Viewed gallery",
  gallery_download: "Downloaded photo",
  rsvp: "Submitted RSVP",
  stay: "Requested stay",
  photos: "Uploaded photos",
  query: "Asked a question",
  message: "Shared a wish",
};

const ACTION_ICON: Record<GuestActivityAction, typeof LogIn> = {
  login: LogIn,
  gallery_view: Images,
  gallery_download: Download,
  rsvp: CheckCircle2,
  stay: BedDouble,
  photos: Camera,
  query: MessageSquare,
  message: MessageSquare,
};

function formatWhen(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function siteLabel(tier?: string | null, site?: string | null) {
  if (tier === "mehfil" || site === "mehfil") return "Mehfil";
  if (tier === "laavan" || site === "laavan") return "Laavan";
  return "Main";
}

function formatActivityDetail(item: GuestActivityEntry) {
  const detail = item.detail?.trim();
  if (!detail) return null;
  if (item.action === "query") return detail;
  if (detail.startsWith("invite:")) {
    const rest = detail.slice("invite:".length);
    const [slug, imageId] = rest.split("|");
    if (item.action === "gallery_download" && imageId) {
      return `Invite ${slug} · photo ${imageId.slice(0, 8)}…`;
    }
    return slug ? `Invite ${slug}` : null;
  }
  if (item.action === "gallery_download") {
    return `Photo ${detail.slice(0, 8)}…`;
  }
  return detail;
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.14em]",
        ok
          ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-white/[0.03] text-muted",
      )}
    >
      {ok ? <Check size={11} strokeWidth={2.5} /> : null}
      {label}
    </span>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Images;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-gold/15 bg-black/20 px-3 py-3">
      <p className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted">
        <Icon size={12} />
        {label}
      </p>
      <p className="mt-1 font-display text-2xl text-cream">{value}</p>
      {hint ? (
        <p className="mt-1 font-body text-[11px] text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function guestSignals(guest: GuestProfile) {
  const stats = guest.stats;
  const viewedGallery =
    (stats?.galleryViews || 0) > 0 || guest.sources.includes("gallery_view");
  const downloaded =
    (stats?.galleryDownloads || 0) > 0 ||
    guest.sources.includes("gallery_download");
  const didRsvp =
    Boolean(guest.rsvp) ||
    (guest.rsvps && guest.rsvps.length > 0) ||
    guest.sources.includes("rsvp");
  const didStay =
    Boolean(guest.stay) ||
    (guest.stays && guest.stays.length > 0) ||
    guest.sources.includes("stay");
  const didPhotos =
    guest.photoUploads > 0 || guest.sources.includes("photos");
  const didQuery =
    guest.sources.includes("query") ||
    (guest.activity || []).some((item) => item.action === "query");
  const queryCount = (guest.activity || []).filter(
    (item) => item.action === "query",
  ).length;
  return {
    viewedGallery,
    downloaded,
    didRsvp,
    didStay,
    didPhotos,
    didQuery,
    queryCount,
  };
}

export function GuestLoginsManager() {
  const [guests, setGuests] = useState<GuestProfile[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [query, setQuery] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/guests", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load guests");
      const data = (await res.json()) as { guests?: GuestProfile[] };
      setGuests(data.guests || []);
    } catch {
      setError("Could not load guest analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    return guests.reduce(
      (acc, guest) => {
        const signals = guestSignals(guest);
        acc.total += 1;
        if (signals.viewedGallery) acc.gallery += 1;
        if (signals.downloaded) acc.downloads += 1;
        if (signals.didRsvp) acc.rsvp += 1;
        if (signals.didStay) acc.stay += 1;
        if (signals.didPhotos) acc.photos += 1;
        if (signals.didQuery) acc.query += 1;
        return acc;
      },
      {
        total: 0,
        gallery: 0,
        downloads: 0,
        rsvp: 0,
        stay: 0,
        photos: 0,
        query: 0,
      },
    );
  }, [guests]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return guests.filter((guest) => {
      const signals = guestSignals(guest);
      if (filter === "rsvp" && !signals.didRsvp) return false;
      if (filter === "stay" && !signals.didStay) return false;
      if (filter === "photos" && !signals.didPhotos) return false;
      if (filter === "gallery" && !signals.viewedGallery) return false;
      if (filter === "downloads" && !signals.downloaded) return false;
      if (filter === "query" && !signals.didQuery) return false;
      if (!needle) return true;
      const hay = [
        guest.name,
        guest.email,
        guest.phone,
        guest.inviteSlug,
        ...(guest.activity || []).map((item) => item.detail),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [filter, guests, query]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <UserRound size={18} className="text-gold" />
            <h2 className="font-display text-2xl text-cream">Guest analytics</h2>
          </div>
          <p className="mt-1 max-w-2xl font-body text-sm text-muted">
            Full activity for each signed-in guest — RSVP, stay, uploads,
            gallery views, downloads, and questions — not only photos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-full border border-gold/25 px-4 py-2 font-body text-[10px] uppercase tracking-[0.18em] text-gold-soft hover:bg-gold/10"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {(
          [
            ["Guests", summary.total],
            ["RSVP", summary.rsvp],
            ["Stay", summary.stay],
            ["Uploads", summary.photos],
            ["Gallery", summary.gallery],
            ["Downloads", summary.downloads],
            ["Questions", summary.query],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-gold/15 bg-[#141018] px-3 py-3"
          >
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
              {label}
            </p>
            <p className="mt-1 font-display text-2xl text-cream">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[14rem] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, invite…"
            className="w-full rounded-full border border-gold/20 bg-[#141018] py-2.5 pl-9 pr-4 font-body text-sm text-cream outline-none placeholder:text-muted/70 focus:border-gold/50"
          />
        </label>
        {(
          [
            ["all", `All (${summary.total})`],
            ["rsvp", `RSVP (${summary.rsvp})`],
            ["stay", `Stay (${summary.stay})`],
            ["photos", `Uploads (${summary.photos})`],
            ["gallery", `Gallery (${summary.gallery})`],
            ["downloads", `Downloads (${summary.downloads})`],
            ["query", `Questions (${summary.query})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-full border px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.16em] transition",
              filter === id
                ? "border-gold/50 bg-gold/15 text-gold-soft"
                : "border-gold/20 text-muted hover:text-cream",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading && guests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
          Loading guest analytics…
        </p>
      ) : null}
      {!loading && !error && filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
          {guests.length === 0
            ? "No guest sign-ins recorded yet."
            : "No guests match this filter."}
        </p>
      ) : null}

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((guest) => {
            const open = openUid === guest.uid;
            const stats = guest.stats;
            const signals = guestSignals(guest);
            const rsvps =
              guest.rsvps && guest.rsvps.length > 0
                ? guest.rsvps
                : guest.rsvp
                  ? [guest.rsvp]
                  : [];
            const stays =
              guest.stays && guest.stays.length > 0
                ? guest.stays
                : guest.stay
                  ? [guest.stay]
                  : [];
            const queries = (guest.activity || []).filter(
              (item) => item.action === "query",
            );
            const activity = guest.activity || [];
            const source = {
              side: guest.inviteSide,
              tier: guest.inviteTier,
              slug: guest.inviteSlug,
            };

            return (
              <div
                key={guest.uid}
                className="rounded-2xl border border-gold/20 bg-[#141018]"
              >
                <button
                  type="button"
                  onClick={() => setOpenUid(open ? null : guest.uid)}
                  className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-lg text-cream">
                        {guest.name || "Guest"}
                      </p>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em]",
                          sourceBadgeClass(source),
                        )}
                      >
                        {inviteSourceBadge(source)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate font-body text-sm text-muted">
                      {guest.email || "No email"}
                      {guest.phone ? ` · ${guest.phone}` : ""}
                    </p>
                    <p className="mt-1 font-body text-xs text-muted">
                      {inviteSourceDetail(source)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Flag ok={signals.didRsvp} label="RSVP" />
                      <Flag ok={signals.didStay} label="Stay" />
                      <Flag ok={signals.didPhotos} label="Uploads" />
                      <Flag ok={signals.viewedGallery} label="Gallery" />
                      <Flag ok={signals.downloaded} label="Downloads" />
                      <Flag ok={signals.didQuery} label="Questions" />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden text-right sm:block">
                      <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                        Last seen
                      </p>
                      <p className="mt-1 font-body text-xs text-gold-soft">
                        {formatWhen(guest.lastSeenAt)}
                      </p>
                    </div>
                    {open ? (
                      <ChevronUp size={16} className="text-muted" />
                    ) : (
                      <ChevronDown size={16} className="text-muted" />
                    )}
                  </div>
                </button>

                {open ? (
                  <div className="border-t border-gold/10 px-4 py-4">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                      <StatTile
                        icon={CheckCircle2}
                        label="RSVP"
                        value={rsvps.length || "—"}
                        hint={
                          rsvps[0]
                            ? `${rsvps[0].attendance.toUpperCase()} · ${formatWhen(stats?.lastRsvpAt || rsvps[0].createdAt)}`
                            : "Not submitted"
                        }
                      />
                      <StatTile
                        icon={BedDouble}
                        label="Stay"
                        value={stays.length || "—"}
                        hint={
                          stays[0]
                            ? `${stays[0].status} · ${formatWhen(stats?.lastStayAt || stays[0].createdAt)}`
                            : "No stay request"
                        }
                      />
                      <StatTile
                        icon={Camera}
                        label="Uploads"
                        value={guest.photoUploads}
                        hint={`Last: ${formatWhen(stats?.lastPhotoUploadAt)}`}
                      />
                      <StatTile
                        icon={Images}
                        label="Gallery views"
                        value={stats?.galleryViews || 0}
                        hint={`Last: ${formatWhen(stats?.lastGalleryViewAt)}`}
                      />
                      <StatTile
                        icon={Download}
                        label="Downloads"
                        value={stats?.galleryDownloads || 0}
                        hint={`Last: ${formatWhen(stats?.lastGalleryDownloadAt)}`}
                      />
                      <StatTile
                        icon={MessageSquare}
                        label="Questions"
                        value={signals.queryCount}
                        hint={
                          queries[0]
                            ? `Last: ${formatWhen(queries[0].at)}`
                            : "None yet"
                        }
                      />
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-2">
                      <div>
                        <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                          Account
                        </p>
                        <ul className="mt-2 space-y-1.5 font-body text-sm text-cream/90">
                          <li>First seen: {formatWhen(guest.firstSeenAt)}</li>
                          <li>Last seen: {formatWhen(guest.lastSeenAt)}</li>
                          <li>
                            Last login: {formatWhen(stats?.lastLoginAt)}
                          </li>
                          <li>Phone: {guest.phone || "—"}</li>
                          <li>
                            Invite: {guest.inviteSlug || inviteSourceBadge(source)}
                          </li>
                        </ul>
                      </div>

                      <div>
                        <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                          RSVP & stay
                        </p>
                        {rsvps.length === 0 && stays.length === 0 ? (
                          <p className="mt-2 font-body text-sm text-muted">
                            No RSVP or stay linked yet.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {rsvps.map((item) => (
                              <li
                                key={`rsvp-${item.id}`}
                                className="rounded-xl border border-gold/15 bg-black/20 px-3 py-2.5"
                              >
                                <p className="font-body text-[10px] uppercase tracking-[0.16em] text-gold/70">
                                  RSVP · {siteLabel(item.inviteTier, item.inviteSite)}
                                </p>
                                <p className="mt-1 font-body text-sm text-cream">
                                  {item.attendance.toUpperCase()} · {item.guests}{" "}
                                  guest{item.guests === 1 ? "" : "s"}
                                </p>
                                <p className="mt-0.5 font-body text-[11px] text-muted">
                                  {formatWhen(item.createdAt)}
                                </p>
                              </li>
                            ))}
                            {stays.map((item) => (
                              <li
                                key={`stay-${item.id}`}
                                className="rounded-xl border border-gold/15 bg-black/20 px-3 py-2.5"
                              >
                                <p className="font-body text-[10px] uppercase tracking-[0.16em] text-gold/70">
                                  Stay · {siteLabel(item.inviteTier, item.inviteSite)}
                                </p>
                                <p className="mt-1 font-body text-sm capitalize text-cream">
                                  {item.status} · {item.rooms} room
                                  {item.rooms === 1 ? "" : "s"} · {item.people}{" "}
                                  people
                                </p>
                                <p className="mt-0.5 font-body text-[11px] text-muted">
                                  {formatWhen(item.createdAt)}
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {queries.length > 0 ? (
                      <div className="mt-5">
                        <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                          Questions
                          <span className="normal-case tracking-normal text-muted/80">
                            {" "}
                            · {queries.length}
                          </span>
                        </p>
                        <ul className="mt-2 space-y-2">
                          {queries.map((item, index) => (
                            <li
                              key={`${item.at}-query-${index}`}
                              className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5"
                            >
                              <p className="font-body text-sm text-cream">
                                {item.detail || "Question sent"}
                              </p>
                              <p className="mt-1 font-body text-[11px] text-muted">
                                {formatWhen(item.at)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    {(guest.uploadedImages?.length || 0) > 0 ? (
                      <div className="mt-5">
                        <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                          Uploaded photos
                          <span className="normal-case tracking-normal text-muted/80">
                            {" "}
                            · {guest.uploadedImages!.length}
                          </span>
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                          {guest.uploadedImages!.map((image) => (
                            <a
                              key={image.id}
                              href={image.src}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative aspect-square overflow-hidden rounded-xl border border-gold/20 bg-black/30"
                              title={`${image.alt || "Upload"} · ${image.status}`}
                            >
                              {image.kind === "video" ? (
                                <video
                                  src={image.src}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <img
                                  src={image.src}
                                  alt={image.alt || "Uploaded photo"}
                                  className="h-full w-full object-cover transition group-hover:scale-105"
                                  loading="lazy"
                                />
                              )}
                              <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 font-body text-[9px] uppercase tracking-[0.12em] text-cream">
                                {image.status}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {(guest.downloadedImages?.length || 0) > 0 ? (
                      <div className="mt-5">
                        <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                          Downloaded photos
                          <span className="normal-case tracking-normal text-muted/80">
                            {" "}
                            · {guest.downloadedImages!.length}
                          </span>
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                          {guest.downloadedImages!.map((image) => (
                            <a
                              key={`${image.id}-${image.at}`}
                              href={image.src}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative aspect-square overflow-hidden rounded-xl border border-gold/20 bg-black/30"
                              title={`${image.alt || "Photo"} · ${formatWhen(image.at)}`}
                            >
                              {image.kind === "video" ? (
                                <video
                                  src={image.src}
                                  muted
                                  playsInline
                                  preload="metadata"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <img
                                  src={image.src}
                                  alt={image.alt || "Downloaded photo"}
                                  className="h-full w-full object-cover transition group-hover:scale-105"
                                  loading="lazy"
                                />
                              )}
                              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/65 px-1.5 py-1 font-body text-[9px] text-cream/90 opacity-0 transition group-hover:opacity-100">
                                {formatWhen(image.at)}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : signals.downloaded ? (
                      <p className="mt-5 font-body text-xs text-muted">
                        Downloads were recorded, but photo previews are not
                        available for older activity without an image id.
                      </p>
                    ) : null}

                    <div className="mt-5">
                      <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                        Full activity
                        <span className="normal-case tracking-normal text-muted/80">
                          {" "}
                          · {activity.length}
                        </span>
                      </p>
                      {activity.length === 0 ? (
                        <p className="mt-2 font-body text-sm text-muted">
                          No detailed activity yet.
                        </p>
                      ) : (
                        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                          {activity.map((item, index) => {
                            const Icon = ACTION_ICON[item.action] || LogIn;
                            const detail = formatActivityDetail(item);
                            return (
                              <li
                                key={`${item.at}-${item.action}-${index}`}
                                className="flex items-start gap-3 rounded-xl border border-gold/10 bg-black/15 px-3 py-2.5"
                              >
                                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/20 bg-gold/10 text-gold-soft">
                                  <Icon size={14} />
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <p className="font-body text-sm text-cream">
                                      {ACTION_LABEL[item.action] || item.action}
                                    </p>
                                    <p className="shrink-0 font-body text-[11px] text-muted">
                                      {formatWhen(item.at)}
                                    </p>
                                  </div>
                                  {detail ? (
                                    <p className="mt-0.5 truncate font-body text-xs text-muted">
                                      {detail}
                                    </p>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
