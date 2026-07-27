"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BedDouble,
  Camera,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Images,
  MessageSquare,
  ScanFace,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  GuestAuthPanel,
  getGuestIdToken,
} from "@/components/rsvp/GuestAuthPanel";
import { Button } from "@/components/ui/Button";
import { useGuestAuth } from "@/hooks/useGuestAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useInvite } from "@/lib/invite-context";
import type {
  AccommodationRequest,
  GalleryStatus,
  GuestFaceProfile,
  RsvpEntry,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type AccountResponse = {
  guest?: { uid: string; email?: string; name?: string };
  features?: {
    rsvp: boolean;
    accommodation: boolean;
    guestPhotos: boolean;
    faceFind: boolean;
  };
  rsvp?: RsvpEntry | null;
  accommodation?: AccommodationRequest | null;
  uploads?: {
    counts: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
    };
    images: Array<{
      id: string;
      alt: string;
      status: GalleryStatus;
      kind: "image" | "video";
      createdAt: string;
      eventId: string;
      eventName?: string;
      src: string;
    }>;
  };
  face?: {
    profile: GuestFaceProfile | null;
    rekognitionReady: boolean;
  } | null;
  error?: string;
};

const fieldClass =
  "w-full rounded-xl border border-gold/25 bg-[#141018] px-4 py-3 font-body text-sm text-cream outline-none transition placeholder:text-muted/60 focus:border-gold/60 focus:bg-[#1a1520]";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function attendanceLabel(value?: RsvpEntry["attendance"]) {
  if (value === "yes") return "Attending";
  if (value === "no") return "Not attending";
  if (value === "maybe") return "Maybe";
  return "Not submitted";
}

function stayStatusLabel(stay: AccommodationRequest | null | undefined) {
  if (!stay) return { label: "No stay request", tone: "muted" as const };
  if (stay.offerStatus === "pending") {
    return { label: "Shorter-stay offer pending", tone: "amber" as const };
  }
  if (stay.offerStatus === "declined") {
    return { label: "Shorter-stay offer declined", tone: "rose" as const };
  }
  if (stay.status === "confirmed") {
    return { label: "Confirmed", tone: "green" as const };
  }
  if (stay.status === "declined") {
    return { label: "Declined", tone: "rose" as const };
  }
  return { label: "Awaiting family review", tone: "amber" as const };
}

function uploadStatusMeta(status: GalleryStatus) {
  if (status === "approved") {
    return {
      label: "Approved",
      icon: CheckCircle2,
      className: "text-emerald-300",
    };
  }
  if (status === "rejected") {
    return { label: "Not approved", icon: XCircle, className: "text-rose-300" };
  }
  return { label: "In review", icon: Clock3, className: "text-amber-200" };
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "muted" | "amber" | "green" | "rose";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 font-body text-[10px] uppercase tracking-[0.18em]",
        tone === "green" && "bg-emerald-400/15 text-emerald-200",
        tone === "amber" && "bg-amber-400/15 text-amber-100",
        tone === "rose" && "bg-rose-400/15 text-rose-200",
        tone === "muted" && "bg-white/5 text-muted",
      )}
    >
      {label}
    </span>
  );
}

function Section({
  id,
  icon: Icon,
  title,
  subtitle,
  children,
  action,
}: {
  id: string;
  icon: typeof BedDouble;
  title: string;
  subtitle: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t border-gold/15 pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-gold-soft">
            <Icon size={18} />
            <p className="font-body text-[11px] uppercase tracking-[0.22em]">
              {title}
            </p>
          </div>
          <h2 className="mt-2 font-display text-3xl text-cream">{title}</h2>
          <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-muted">
            {subtitle}
          </p>
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function GuestAccountPanel() {
  const { user, ready: authReady, configured } = useGuestAuth();
  const { site, enabled, ready: flagsReady } = useFeatureFlags();
  const invite = useInvite();
  const rsvpHref = invite ? `${invite.basePath}#rsvp` : "/#rsvp";
  const uploadHref = invite ? `${invite.basePath}#share-photos` : "/#share-photos";
  const [data, setData] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [topic, setTopic] = useState<"booking" | "rsvp" | "photos" | "other">(
    "booking",
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [queryBusy, setQueryBusy] = useState(false);
  const [queryDone, setQueryDone] = useState(false);
  const [queryError, setQueryError] = useState("");

  const load = useCallback(async () => {
    if (!user) {
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setError("Please sign in again.");
        return;
      }
      const res = await fetch(`/api/account?site=${encodeURIComponent(site)}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as AccountResponse;
      if (!res.ok) {
        setError(json.error || "Could not load your account.");
        return;
      }
      setData(json);
    } catch {
      setError("Could not load your account.");
    } finally {
      setLoading(false);
    }
  }, [site, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendQuery = async (event: React.FormEvent) => {
    event.preventDefault();
    setQueryBusy(true);
    setQueryError("");
    setQueryDone(false);
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setQueryError("Please sign in again.");
        return;
      }
      const res = await fetch("/api/guests/query", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic, subject, message }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setQueryError(json.error || "Could not send your question.");
        return;
      }
      setQueryDone(true);
      setSubject("");
      setMessage("");
    } catch {
      setQueryError("Could not send your question.");
    } finally {
      setQueryBusy(false);
    }
  };

  if (!authReady) {
    return (
      <p className="font-body text-sm uppercase tracking-[0.18em] text-muted">
        Checking sign-in…
      </p>
    );
  }

  if (!configured) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-6">
        <p className="font-display text-xl text-cream">Sign-in setup needed</p>
        <p className="mt-2 font-body text-sm text-amber-100/90">
          Google sign-in is not configured yet, so guest accounts are unavailable.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg">
        <p className="font-body text-[11px] uppercase tracking-[0.22em] text-gold-soft">
          My account
        </p>
        <h1 className="mt-3 font-display text-4xl text-cream sm:text-5xl">
          Your wedding details
        </h1>
        <p className="mt-4 font-body text-sm leading-relaxed text-muted">
          Sign in with the same Google account you used for RSVP, stay, or photo
          uploads to see status and ask the family a question.
        </p>
        <div className="mt-8">
          <GuestAuthPanel
            onAuthed={() => undefined}
            title="Sign in to continue"
            subtitle="One Google account keeps your RSVP, stay, and photos together."
            ctaLabel="Continue with Google"
          />
        </div>
      </div>
    );
  }

  const stay = data?.accommodation || null;
  const stayMeta = stayStatusLabel(stay);
  const rsvp = data?.rsvp || null;
  const uploads = data?.uploads;
  const face = data?.face?.profile || null;
  const greeting =
    user.displayName?.trim().split(/\s+/)[0] ||
    data?.guest?.name?.trim().split(/\s+/)[0] ||
    "there";

  return (
    <div>
      <header className="max-w-2xl">
        <p className="font-body text-[11px] uppercase tracking-[0.22em] text-gold-soft">
          My account
        </p>
        <h1 className="mt-3 font-display text-4xl text-cream sm:text-5xl">
          Welcome, {greeting}
        </h1>
        <p className="mt-4 font-body text-sm leading-relaxed text-muted">
          Check your RSVP, stay booking, photo uploads, and send a quick question
          to the family.
        </p>
        {user.email ? (
          <p className="mt-3 font-body text-xs text-muted/80">{user.email}</p>
        ) : null}
      </header>

      {loading && !data ? (
        <p className="mt-10 font-body text-sm text-muted">Loading your details…</p>
      ) : null}
      {error ? (
        <p className="mt-6 font-body text-sm text-rose-200">{error}</p>
      ) : null}

      {data ? (
        <div className="mt-4 space-y-2">
          <Section
            id="booking"
            icon={BedDouble}
            title="Stay booking"
            subtitle="Current hotel request and confirmation status."
            action={
              flagsReady && enabled("accommodation") ? (
                <Link
                  href={rsvpHref}
                  className="font-body text-[11px] uppercase tracking-[0.18em] text-gold-soft transition hover:text-gold"
                >
                  Update stay
                </Link>
              ) : null
            }
          >
            {!stay ? (
              <div className="rounded-2xl border border-gold/20 bg-white/[0.03] px-5 py-6">
                <p className="font-body text-sm text-muted">
                  No stay request on file yet.
                </p>
                {flagsReady && enabled("accommodation") ? (
                  <Link
                    href={rsvpHref}
                    className="mt-4 inline-flex font-body text-[11px] uppercase tracking-[0.18em] text-gold-soft"
                  >
                    Request accommodation
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-gold/20 bg-white/[0.03] px-5 py-6">
                <div className="flex flex-wrap items-center gap-3">
                  <StatusPill label={stayMeta.label} tone={stayMeta.tone} />
                  <p className="font-body text-xs text-muted">
                    Submitted {formatDate(stay.createdAt)}
                  </p>
                </div>
                <dl className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                      Guests / rooms
                    </dt>
                    <dd className="mt-1 font-body text-sm text-cream">
                      {stay.people} guest{stay.people === 1 ? "" : "s"} ·{" "}
                      {stay.rooms} room{stay.rooms === 1 ? "" : "s"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                      Dates
                    </dt>
                    <dd className="mt-1 font-body text-sm text-cream">
                      {formatDate(stay.checkIn)} → {formatDate(stay.checkOut)}
                    </dd>
                  </div>
                  {stay.hotelName ? (
                    <div className="sm:col-span-2">
                      <dt className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                        Hotel
                      </dt>
                      <dd className="mt-1 font-body text-sm text-cream">
                        {stay.hotelName}
                        {stay.hotelAddress ? ` · ${stay.hotelAddress}` : ""}
                      </dd>
                    </div>
                  ) : null}
                  {stay.roomDetails ? (
                    <div className="sm:col-span-2">
                      <dt className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                        Room details
                      </dt>
                      <dd className="mt-1 font-body text-sm text-cream">
                        {stay.roomDetails}
                      </dd>
                    </div>
                  ) : null}
                  {stay.roomShareWith && stay.roomShareWith.length > 0 ? (
                    <div className="sm:col-span-2">
                      <dt className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                        Sharing with
                      </dt>
                      <dd className="mt-1 font-body text-sm text-cream">
                        {stay.roomShareWith.join(", ")}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                {stay.offerStatus === "pending" ? (
                  <p className="mt-5 font-body text-sm text-amber-100/90">
                    The family offered different dates — check your email for the
                    accept / decline link.
                  </p>
                ) : null}
              </div>
            )}
          </Section>

          <Section
            id="rsvp"
            icon={CheckCircle2}
            title="RSVP"
            subtitle="Your attendance reply for this celebration."
            action={
              flagsReady && enabled("rsvp") ? (
                <Link
                  href={rsvpHref}
                  className="font-body text-[11px] uppercase tracking-[0.18em] text-gold-soft transition hover:text-gold"
                >
                  {rsvp ? "Update RSVP" : "Send RSVP"}
                </Link>
              ) : null
            }
          >
            <div className="rounded-2xl border border-gold/20 bg-white/[0.03] px-5 py-6">
              {!rsvp ? (
                <p className="font-body text-sm text-muted">
                  No RSVP submitted yet with this Google account.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusPill
                      label={attendanceLabel(rsvp.attendance)}
                      tone={
                        rsvp.attendance === "yes"
                          ? "green"
                          : rsvp.attendance === "no"
                            ? "rose"
                            : "amber"
                      }
                    />
                    <p className="font-body text-xs text-muted">
                      {rsvp.guests} guest{rsvp.guests === 1 ? "" : "s"}
                      {rsvp.meal ? ` · ${rsvp.meal}` : ""}
                    </p>
                  </div>
                  {rsvp.dayResponses && rsvp.dayResponses.length > 0 ? (
                    <ul className="mt-5 space-y-2">
                      {rsvp.dayResponses.map((day) => (
                        <li
                          key={day.dateKey}
                          className="flex flex-wrap items-center justify-between gap-2 font-body text-sm text-cream"
                        >
                          <span>{day.label || day.date}</span>
                          <span className="text-muted">
                            {attendanceLabel(day.attendance)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              )}
            </div>
          </Section>

          <Section
            id="uploads"
            icon={Camera}
            title="Your uploads"
            subtitle="Photos you shared for the gallery, and where each one stands."
            action={
              flagsReady && enabled("guest_photos") ? (
                <Link
                  href={uploadHref}
                  className="font-body text-[11px] uppercase tracking-[0.18em] text-gold-soft transition hover:text-gold"
                >
                  Upload more
                </Link>
              ) : null
            }
          >
            <div className="rounded-2xl border border-gold/20 bg-white/[0.03] px-5 py-6">
              {!uploads || uploads.counts.total === 0 ? (
                <p className="font-body text-sm text-muted">
                  You have not uploaded any photos yet.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3">
                    <StatusPill
                      label={`${uploads.counts.total} total`}
                      tone="muted"
                    />
                    {uploads.counts.pending > 0 ? (
                      <StatusPill
                        label={`${uploads.counts.pending} in review`}
                        tone="amber"
                      />
                    ) : null}
                    {uploads.counts.approved > 0 ? (
                      <StatusPill
                        label={`${uploads.counts.approved} approved`}
                        tone="green"
                      />
                    ) : null}
                    {uploads.counts.rejected > 0 ? (
                      <StatusPill
                        label={`${uploads.counts.rejected} not approved`}
                        tone="rose"
                      />
                    ) : null}
                  </div>
                  <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {uploads.images.map((image) => {
                      const meta = uploadStatusMeta(image.status);
                      const Icon = meta.icon;
                      return (
                        <li
                          key={image.id}
                          className="overflow-hidden rounded-xl border border-gold/15 bg-[#120f16]"
                        >
                          <div className="relative aspect-square bg-black/30">
                            {image.kind === "image" ? (
                              <Image
                                src={image.src}
                                alt={image.alt || "Your upload"}
                                fill
                                unoptimized
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center font-body text-xs text-muted">
                                Video
                              </div>
                            )}
                          </div>
                          <div className="space-y-1 px-3 py-3">
                            <p
                              className={cn(
                                "inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.16em]",
                                meta.className,
                              )}
                            >
                              <Icon size={12} />
                              {meta.label}
                            </p>
                            <p className="truncate font-body text-xs text-cream">
                              {image.eventName || "Wedding gallery"}
                            </p>
                            <p className="font-body text-[11px] text-muted">
                              {formatDate(image.createdAt)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </Section>

          {flagsReady && enabled("face_find") ? (
            <Section
              id="find-photos"
              icon={ScanFace}
              title="Find my photos"
              subtitle="Selfie match status for your private wedding album."
              action={
                <Link
                  href="/my-photos"
                  className="font-body text-[11px] uppercase tracking-[0.18em] text-gold-soft transition hover:text-gold"
                >
                  Open album
                </Link>
              }
            >
              <div className="rounded-2xl border border-gold/20 bg-white/[0.03] px-5 py-6">
                {!face ? (
                  <p className="font-body text-sm text-muted">
                    No selfie enrolled yet. Open Find my photos to start.
                  </p>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusPill
                      label={
                        face.status === "ready"
                          ? `${face.matchCount} match${face.matchCount === 1 ? "" : "es"}`
                          : face.status === "matching"
                            ? "Matching…"
                            : face.status === "failed"
                              ? "Needs attention"
                              : "Needs selfie"
                      }
                      tone={
                        face.status === "ready"
                          ? "green"
                          : face.status === "failed"
                            ? "rose"
                            : "amber"
                      }
                    />
                    <p className="font-body text-xs text-muted">
                      Updated {formatDate(face.updatedAt || face.enrolledAt)}
                    </p>
                  </div>
                )}
              </div>
            </Section>
          ) : null}

          <Section
            id="query"
            icon={MessageSquare}
            title="Ask a question"
            subtitle="Send a short note to the family about your booking, RSVP, or photos."
          >
            <form
              onSubmit={sendQuery}
              className="rounded-2xl border border-gold/20 bg-white/[0.03] px-5 py-6"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-1">
                  <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                    Topic
                  </span>
                  <select
                    className={cn(fieldClass, "mt-2")}
                    value={topic}
                    onChange={(event) =>
                      setTopic(
                        event.target.value as
                          | "booking"
                          | "rsvp"
                          | "photos"
                          | "other",
                      )
                    }
                  >
                    <option value="booking">Stay / booking</option>
                    <option value="rsvp">RSVP</option>
                    <option value="photos">Photos</option>
                    <option value="other">Something else</option>
                  </select>
                </label>
                <label className="block sm:col-span-1">
                  <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                    Subject
                  </span>
                  <input
                    className={cn(fieldClass, "mt-2")}
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    maxLength={120}
                    required
                    placeholder="Short subject"
                  />
                </label>
              </div>
              <label className="mt-4 block">
                <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                  Message
                </span>
                <textarea
                  className={cn(fieldClass, "mt-2 min-h-28 resize-y")}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={2000}
                  required
                  placeholder="Ask about dates, room details, uploads, or anything else."
                />
              </label>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <Button type="submit" disabled={queryBusy}>
                  <CircleHelp size={16} />
                  {queryBusy ? "Sending…" : "Send question"}
                </Button>
                {queryDone ? (
                  <p className="font-body text-sm text-emerald-200">
                    Sent — the family will follow up by email.
                  </p>
                ) : null}
                {queryError ? (
                  <p className="font-body text-sm text-rose-200">{queryError}</p>
                ) : null}
              </div>
            </form>
          </Section>

          <div className="border-t border-gold/15 pt-8">
            <div className="flex flex-wrap gap-4">
              <Link
                href="/gallery"
                className="inline-flex items-center gap-2 font-body text-[11px] uppercase tracking-[0.18em] text-muted transition hover:text-gold-soft"
              >
                <Images size={14} />
                Gallery
              </Link>
              {flagsReady && enabled("face_find") ? (
                <Link
                  href="/my-photos"
                  className="inline-flex items-center gap-2 font-body text-[11px] uppercase tracking-[0.18em] text-muted transition hover:text-gold-soft"
                >
                  <ScanFace size={14} />
                  Find my photos
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
