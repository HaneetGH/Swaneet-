"use client";

import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  Images,
  UserRound,
} from "lucide-react";
import type { GuestActivityAction, GuestProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<GuestActivityAction, string> = {
  login: "Signed in",
  gallery_view: "Viewed gallery",
  gallery_download: "Downloaded photo",
  rsvp: "Submitted RSVP",
  stay: "Requested stay",
  photos: "Uploaded photos",
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

function Flag({
  ok,
  label,
}: {
  ok: boolean;
  label: string;
}) {
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

export function GuestLoginsManager() {
  const [guests, setGuests] = useState<GuestProfile[]>([]);
  const [error, setError] = useState("");
  const [openUid, setOpenUid] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/guests")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load guests");
        return res.json();
      })
      .then((data: { guests?: GuestProfile[] }) => {
        if (alive) setGuests(data.guests || []);
      })
      .catch(() => {
        if (alive) setError("Could not load logged-in guests");
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <UserRound size={18} className="text-gold" />
        <h2 className="font-display text-2xl text-cream">Logged-in guests</h2>
      </div>
      <p className="mb-6 font-body text-sm text-muted">
        Who signed in with Google — gallery views, downloads, RSVP, stay, and
        photo uploads.
      </p>

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : guests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
          No guest sign-ins recorded yet.
        </p>
      ) : (
        <div className="space-y-3">
          {guests.map((guest) => {
            const open = openUid === guest.uid;
            const stats = guest.stats;
            const viewedGallery =
              (stats?.galleryViews || 0) > 0 ||
              guest.sources.includes("gallery_view");
            const downloaded =
              (stats?.galleryDownloads || 0) > 0 ||
              guest.sources.includes("gallery_download");
            const didRsvp = Boolean(guest.rsvp) || guest.sources.includes("rsvp");
            const didStay = Boolean(guest.stay) || guest.sources.includes("stay");
            const didPhotos =
              guest.photoUploads > 0 || guest.sources.includes("photos");

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
                    <p className="font-display text-lg text-cream">
                      {guest.name || "Guest"}
                    </p>
                    <p className="mt-0.5 truncate font-body text-sm text-muted">
                      {guest.email || "No email"}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Flag ok={viewedGallery} label="Gallery" />
                      <Flag ok={downloaded} label="Downloads" />
                      <Flag ok={didRsvp} label="RSVP" />
                      <Flag ok={didStay} label="Stay" />
                      <Flag ok={didPhotos} label="Photos" />
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
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl border border-gold/15 bg-black/20 px-3 py-3">
                        <p className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                          <Images size={12} /> Gallery views
                        </p>
                        <p className="mt-1 font-display text-2xl text-cream">
                          {stats?.galleryViews || 0}
                        </p>
                        <p className="mt-1 font-body text-[11px] text-muted">
                          Last: {formatWhen(stats?.lastGalleryViewAt)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gold/15 bg-black/20 px-3 py-3">
                        <p className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                          <Download size={12} /> Downloads
                        </p>
                        <p className="mt-1 font-display text-2xl text-cream">
                          {stats?.galleryDownloads || 0}
                        </p>
                        <p className="mt-1 font-body text-[11px] text-muted">
                          Last: {formatWhen(stats?.lastGalleryDownloadAt)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-gold/15 bg-black/20 px-3 py-3">
                        <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                          RSVP
                        </p>
                        {guest.rsvp ? (
                          <>
                            <p className="mt-1 font-body text-sm text-cream">
                              {guest.rsvp.attendance.toUpperCase()} ·{" "}
                              {guest.rsvp.guests} guest
                              {guest.rsvp.guests === 1 ? "" : "s"}
                            </p>
                            <p className="mt-1 font-body text-[11px] text-muted">
                              {formatWhen(guest.rsvp.createdAt)}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 font-body text-sm text-muted">
                            Not submitted
                          </p>
                        )}
                      </div>
                      <div className="rounded-xl border border-gold/15 bg-black/20 px-3 py-3">
                        <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                          Stay
                        </p>
                        {guest.stay ? (
                          <>
                            <p className="mt-1 font-body text-sm capitalize text-cream">
                              {guest.stay.status} · {guest.stay.rooms} room
                              {guest.stay.rooms === 1 ? "" : "s"} ·{" "}
                              {guest.stay.people} people
                            </p>
                            <p className="mt-1 font-body text-[11px] text-muted">
                              {formatWhen(guest.stay.createdAt)}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 font-body text-sm text-muted">
                            No stay request
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                          Account
                        </p>
                        <ul className="mt-2 space-y-1 font-body text-sm text-cream/90">
                          <li>First seen: {formatWhen(guest.firstSeenAt)}</li>
                          <li>Last seen: {formatWhen(guest.lastSeenAt)}</li>
                          <li>
                            Photo uploads: {guest.photoUploads}
                            {stats?.lastPhotoUploadAt
                              ? ` · last ${formatWhen(stats.lastPhotoUploadAt)}`
                              : ""}
                          </li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                          Recent activity
                        </p>
                        {(guest.activity || []).length === 0 ? (
                          <p className="mt-2 font-body text-sm text-muted">
                            No detailed activity yet.
                          </p>
                        ) : (
                          <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                            {(guest.activity || []).slice(0, 12).map((item, i) => (
                              <li
                                key={`${item.at}-${item.action}-${i}`}
                                className="flex items-baseline justify-between gap-3 font-body text-xs"
                              >
                                <span className="text-cream">
                                  {ACTION_LABEL[item.action] || item.action}
                                </span>
                                <span className="shrink-0 text-muted">
                                  {formatWhen(item.at)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
