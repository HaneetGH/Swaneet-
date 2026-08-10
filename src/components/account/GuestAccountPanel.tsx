"use client";

import Image from "next/image";
import Link from "next/link";
import {
  BedDouble,
  Camera,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Heart,
  Images,
  Menu,
  MessageSquare,
  Pencil,
  ScanFace,
  Send,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  GuestAuthPanel,
  getGuestIdToken,
} from "@/components/rsvp/GuestAuthPanel";
import { Button } from "@/components/ui/Button";
import { useGuestAuth } from "@/hooks/useGuestAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { wedding } from "@/data/wedding";
import { guestActionPath, wishesWritePath } from "@/lib/guest-paths";
import { useInvite } from "@/lib/invite-context";
import {
  deriveOverallAttendance,
  rsvpDaysForSite,
  type RsvpDayOption,
} from "@/lib/rsvp-days";
import type {
  AccommodationRequest,
  GalleryStatus,
  GuestFaceProfile,
  GuestMessageStatus,
  RsvpDayResponse,
  RsvpEntry,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type AccountTab =
  | "booking"
  | "rsvp"
  | "uploads"
  | "wishes"
  | "find-photos"
  | "query";

type AccountResponse = {
  guest?: { uid: string; email?: string; name?: string };
  features?: {
    rsvp: boolean;
    accommodation: boolean;
    guestPhotos: boolean;
    faceFind: boolean;
    guestMessages?: boolean;
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
  wishes?: {
    counts: {
      total: number;
      pending: number;
      approved: number;
      rejected: number;
    };
    maxPerGuest: number;
    remaining: number;
    items: Array<{
      id: string;
      body: string;
      displayName: string;
      status: GuestMessageStatus;
      createdAt: string;
    }>;
  };
  face?: {
    profile: GuestFaceProfile | null;
    rekognitionReady: boolean;
  } | null;
  error?: string;
};

type NavItem = {
  id: AccountTab;
  label: string;
  hint: string;
  Icon: typeof BedDouble;
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

function wishStatusMeta(status: GuestMessageStatus) {
  if (status === "approved") {
    return {
      label: "On the wall",
      icon: CheckCircle2,
      tone: "green" as const,
    };
  }
  if (status === "rejected") {
    return {
      label: "Not approved",
      icon: XCircle,
      tone: "rose" as const,
    };
  }
  return {
    label: "In review",
    icon: Clock3,
    tone: "amber" as const,
  };
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

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl text-cream sm:text-4xl">
            {title}
          </h2>
          <p className="mt-2 max-w-xl font-body text-sm leading-relaxed text-muted">
            {subtitle}
          </p>
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function tabFromHash(hash: string, allowed: AccountTab[]): AccountTab | null {
  const id = hash.replace(/^#/, "") as AccountTab;
  return allowed.includes(id) ? id : null;
}

export function GuestAccountPanel() {
  const { user, ready: authReady, configured } = useGuestAuth();
  const { site, enabled, ready: flagsReady } = useFeatureFlags();
  const invite = useInvite();
  const rsvpHref = guestActionPath("/rsvp", invite);
  const uploadHref = guestActionPath("/upload", invite);
  const galleryHref = guestActionPath("/gallery", invite);
  const photosHref = guestActionPath("/my-photos", invite);
  const homeHref = invite?.basePath || "/";
  const [data, setData] = useState<AccountResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [tab, setTab] = useState<AccountTab>("booking");
  const [topic, setTopic] = useState<"booking" | "rsvp" | "photos" | "other">(
    "booking",
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [queryBusy, setQueryBusy] = useState(false);
  const [queryDone, setQueryDone] = useState(false);
  const [queryError, setQueryError] = useState("");
  const [wishBody, setWishBody] = useState("");
  const [wishBusy, setWishBusy] = useState(false);
  const [wishDone, setWishDone] = useState("");
  const [wishError, setWishError] = useState("");
  const [editingWishId, setEditingWishId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [removingWishId, setRemovingWishId] = useState<string | null>(null);
  const [editingRsvp, setEditingRsvp] = useState(false);
  const [rsvpBusy, setRsvpBusy] = useState(false);
  const [rsvpError, setRsvpError] = useState("");
  const [rsvpDone, setRsvpDone] = useState("");
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpGuests, setRsvpGuests] = useState(1);
  const [rsvpAttendance, setRsvpAttendance] = useState<
    "yes" | "no" | "maybe"
  >("yes");
  const [rsvpMeal, setRsvpMeal] = useState<
    "vegetarian" | "non-vegetarian" | "no-preference"
  >("no-preference");
  const [rsvpNotes, setRsvpNotes] = useState("");
  const [rsvpFamily, setRsvpFamily] = useState("");
  const [rsvpDayAnswers, setRsvpDayAnswers] = useState<
    Record<string, "yes" | "no" | "maybe">
  >({});

  const navItems = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      {
        id: "booking",
        label: "Stay booking",
        hint: "Hotel status & dates",
        Icon: BedDouble,
      },
      {
        id: "rsvp",
        label: "RSVP",
        hint: "Attendance reply",
        Icon: CheckCircle2,
      },
      {
        id: "uploads",
        label: "Your uploads",
        hint: "Photo review status",
        Icon: Camera,
      },
    ];
    if (!flagsReady || enabled("guest_messages")) {
      items.push({
        id: "wishes",
        label: "Your wishes",
        hint: "Write multiple blessings",
        Icon: Heart,
      });
    }
    if (flagsReady && enabled("face_find")) {
      items.push({
        id: "find-photos",
        label: "Find my photos",
        hint: "Selfie match album",
        Icon: ScanFace,
      });
    }
    items.push({
      id: "query",
      label: "Ask a question",
      hint: "Message the family",
      Icon: MessageSquare,
    });
    return items;
  }, [enabled, flagsReady]);

  const allowedTabs = useMemo(
    () => navItems.map((item) => item.id),
    [navItems],
  );
  const activeTab = allowedTabs.includes(tab) ? tab : allowedTabs[0] || "booking";
  const activeItem =
    navItems.find((item) => item.id === activeTab) || navItems[0];

  const selectTab = useCallback((id: AccountTab) => {
    setTab(id);
    setMobileNavOpen(false);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromHash = tabFromHash(window.location.hash, allowedTabs);
    if (fromHash) setTab(fromHash);

    const onHash = () => {
      const next = tabFromHash(window.location.hash, allowedTabs);
      if (next) setTab(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [allowedTabs]);

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

  const wishSignedAsName =
    user?.displayName?.trim() ||
    data?.guest?.name?.trim() ||
    user?.email?.split("@")[0]?.trim() ||
    data?.guest?.email?.split("@")[0]?.trim() ||
    "Guest";
  const wishSignedAsEmail =
    user?.email?.trim() || data?.guest?.email?.trim() || "";

  const sendWish = async (event: FormEvent) => {
    event.preventDefault();
    setWishBusy(true);
    setWishError("");
    setWishDone("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setWishError("Please sign in again.");
        return;
      }
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: wishBody,
          inviteTier: invite?.tier,
          inviteSlug: invite?.slug,
          inviteSide: invite ? "bride" : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setWishError(json.error || "Could not share your wish.");
        return;
      }
      setWishBody("");
      setWishDone(
        "Wish sent — you can write another. Family reviews each one before it goes on the wall.",
      );
      await load();
    } catch {
      setWishError("Could not share your wish.");
    } finally {
      setWishBusy(false);
    }
  };

  const startEditWish = (wish: {
    id: string;
    body: string;
    displayName: string;
  }) => {
    setWishError("");
    setWishDone("");
    setEditingWishId(wish.id);
    setEditBody(wish.body);
  };

  const cancelEditWish = () => {
    setEditingWishId(null);
    setEditBody("");
    setEditBusy(false);
  };

  const saveEditWish = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingWishId) return;
    setEditBusy(true);
    setWishError("");
    setWishDone("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setWishError("Please sign in again.");
        return;
      }
      const res = await fetch(`/api/messages/${encodeURIComponent(editingWishId)}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: editBody,
          inviteTier: invite?.tier,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setWishError(json.error || "Could not update your wish.");
        return;
      }
      cancelEditWish();
      setWishDone(
        "Wish updated — it will be reviewed again before it appears on the wall.",
      );
      await load();
    } catch {
      setWishError("Could not update your wish.");
    } finally {
      setEditBusy(false);
    }
  };

  const removeWish = async (wishId: string) => {
    const confirmed = window.confirm(
      "Remove this wish? This cannot be undone.",
    );
    if (!confirmed) return;

    setRemovingWishId(wishId);
    setWishError("");
    setWishDone("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setWishError("Please sign in again.");
        return;
      }
      const res = await fetch(`/api/messages/${encodeURIComponent(wishId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setWishError(json.error || "Could not remove your wish.");
        return;
      }
      if (editingWishId === wishId) cancelEditWish();
      setWishDone("Wish removed.");
      await load();
    } catch {
      setWishError("Could not remove your wish.");
    } finally {
      setRemovingWishId(null);
    }
  };

  const siteDays = useMemo<RsvpDayOption[]>(
    () => rsvpDaysForSite(site, invite?.events),
    [site, invite?.events],
  );
  const multiDayRsvp = siteDays.length > 1;
  const familyOptions = invite?.invite.rsvpFamilies || wedding.rsvpFamilies;

  const startEditRsvp = (entry?: RsvpEntry | null) => {
    setRsvpError("");
    setRsvpDone("");
    const source = entry || null;
    setRsvpName(
      source?.name ||
        user?.displayName?.trim() ||
        data?.guest?.name?.trim() ||
        "",
    );
    setRsvpGuests(source?.guests || 1);
    setRsvpAttendance(source?.attendance || "yes");
    setRsvpMeal(source?.meal || "no-preference");
    setRsvpNotes(source?.notes || "");
    setRsvpFamily(source?.contactFamily || "");
    const answers: Record<string, "yes" | "no" | "maybe"> = {};
    for (const day of siteDays) {
      const saved = source?.dayResponses?.find((d) => d.dateKey === day.dateKey);
      answers[day.dateKey] = saved?.attendance || source?.attendance || "yes";
    }
    setRsvpDayAnswers(answers);
    setEditingRsvp(true);
  };

  const cancelEditRsvp = () => {
    setEditingRsvp(false);
    setRsvpBusy(false);
    setRsvpError("");
  };

  const saveRsvp = async (event: FormEvent) => {
    event.preventDefault();
    setRsvpBusy(true);
    setRsvpError("");
    setRsvpDone("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setRsvpError("Please sign in again.");
        return;
      }

      const dayResponses: RsvpDayResponse[] = multiDayRsvp
        ? siteDays.map((day) => ({
            dateKey: day.dateKey,
            date: day.date,
            label: day.label,
            attendance: rsvpDayAnswers[day.dateKey] || "yes",
          }))
        : siteDays.map((day) => ({
            dateKey: day.dateKey,
            date: day.date,
            label: day.label,
            attendance: rsvpAttendance,
          }));

      const overall = multiDayRsvp
        ? deriveOverallAttendance(dayResponses)
        : rsvpAttendance;

      const existing = data?.rsvp || null;
      const stay = data?.accommodation || null;
      const needsAccommodation = Boolean(
        existing?.needsAccommodation || stay,
      );

      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: rsvpName,
          guests: rsvpGuests,
          attendance: overall,
          meal: rsvpMeal,
          notes: rsvpNotes || undefined,
          contactFamily: rsvpFamily || undefined,
          needsAccommodation,
          inviteSite: site,
          inviteSide: invite ? "bride" : undefined,
          inviteTier: invite?.tier,
          inviteSlug: invite?.slug,
          dayResponses,
          stay:
            stay
              ? {
                  phone: stay.phone,
                  people: stay.people,
                  rooms: stay.rooms,
                  checkIn: stay.checkIn,
                  checkOut: stay.checkOut,
                  notes: stay.notes,
                }
              : undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setRsvpError(json.error || "Could not save your RSVP.");
        return;
      }
      setEditingRsvp(false);
      setRsvpDone(
        existing ? "RSVP updated." : "RSVP saved — thank you.",
      );
      await load();
    } catch {
      setRsvpError("Could not save your RSVP.");
    } finally {
      setRsvpBusy(false);
    }
  };

  const sendQuery = async (event: FormEvent) => {
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
  const wishes = data?.wishes;
  const face = data?.face?.profile || null;
  const wishHref = wishesWritePath(invite);
  const greeting =
    user.displayName?.trim().split(/\s+/)[0] ||
    data?.guest?.name?.trim().split(/\s+/)[0] ||
    "there";

  const navButton = (item: NavItem) => {
    const active = activeTab === item.id;
    const Icon = item.Icon;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => selectTab(item.id)}
        className={cn(
          "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition",
          active
            ? "bg-gold/15 text-gold-soft"
            : "text-muted hover:bg-white/5 hover:text-cream",
        )}
      >
        <Icon size={16} className="mt-0.5 shrink-0" />
        <span className="min-w-0">
          <span className="block font-body text-sm">{item.label}</span>
          <span className="mt-0.5 block font-body text-[11px] text-muted/90">
            {item.hint}
          </span>
        </span>
      </button>
    );
  };

  const sidebar = (
    <aside className="flex h-full flex-col border border-gold/20 bg-[#120f16]/90">
      <div className="border-b border-gold/15 px-4 py-4">
        <p className="font-body text-[10px] uppercase tracking-[0.22em] text-gold/70">
          My account
        </p>
        <p className="mt-2 truncate font-display text-2xl text-cream">
          {greeting}
        </p>
        {user.email ? (
          <p className="mt-1 truncate font-body text-xs text-muted">
            {user.email}
          </p>
        ) : null}
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3" aria-label="Account">
        {navItems.map(navButton)}
      </nav>
      <div className="space-y-1 border-t border-gold/15 px-2 py-3">
        <Link
          href={galleryHref}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm text-muted transition hover:bg-white/5 hover:text-cream"
        >
          <Images size={16} />
          Gallery
        </Link>
        {flagsReady && enabled("face_find") ? (
          <Link
            href={photosHref}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm text-muted transition hover:bg-white/5 hover:text-cream"
          >
            <ScanFace size={16} />
            Open album
          </Link>
        ) : null}
        <Link
          href={homeHref}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm text-muted transition hover:bg-white/5 hover:text-cream"
        >
          Back to site
        </Link>
      </div>
    </aside>
  );

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.22em] text-gold/70">
            My account
          </p>
          <p className="mt-1 font-display text-2xl text-cream">
            {activeItem?.label || "Account"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="glass gold-border flex h-10 w-10 items-center justify-center rounded-full text-gold-soft"
          aria-label="Open account menu"
        >
          <Menu size={18} />
        </button>
      </div>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close account menu"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-[min(20rem,88vw)] shadow-2xl">
            <div className="relative h-full">
              {sidebar}
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-gold/25 text-muted hover:text-cream"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[16.5rem_minmax(0,1fr)] xl:grid-cols-[17.5rem_minmax(0,1fr)]">
        <div className="hidden lg:block lg:sticky lg:top-28 lg:self-start lg:h-[calc(100vh-8rem)]">
          {sidebar}
        </div>

        <div className="min-w-0">
          {loading && !data ? (
            <p className="font-body text-sm text-muted">Loading your details…</p>
          ) : null}
          {error ? (
            <p className="mb-4 font-body text-sm text-rose-200">{error}</p>
          ) : null}

          {data ? (
            <>
              {activeTab === "booking" ? (
                <Panel
                  title="Stay booking"
                  subtitle="Current hotel request and confirmation status."
                  action={
                    flagsReady &&
                    enabled("accommodation") &&
                    enabled("accommodation_open") ? (
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
                        {flagsReady &&
                        enabled("accommodation") &&
                        !enabled("accommodation_open")
                          ? "Accommodation requests are closed now."
                          : "No stay request on file yet."}
                      </p>
                      {flagsReady &&
                      enabled("accommodation") &&
                      enabled("accommodation_open") ? (
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
                            {formatDate(stay.checkIn)} →{" "}
                            {formatDate(stay.checkOut)}
                          </dd>
                        </div>
                        {stay.hotelName ? (
                          <div className="sm:col-span-2">
                            <dt className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                              Hotel
                            </dt>
                            <dd className="mt-1 font-body text-sm text-cream">
                              {stay.hotelName}
                              {stay.hotelAddress
                                ? ` · ${stay.hotelAddress}`
                                : ""}
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
                          The family offered different dates — check your email
                          for the accept / decline link.
                        </p>
                      ) : null}
                    </div>
                  )}
                </Panel>
              ) : null}

              {activeTab === "rsvp" ? (
                <Panel
                  title="RSVP"
                  subtitle="Your attendance reply for this celebration. Edit anytime from here."
                  action={
                    flagsReady && enabled("rsvp") && !editingRsvp ? (
                      <button
                        type="button"
                        onClick={() => startEditRsvp(rsvp)}
                        className="font-body text-[11px] uppercase tracking-[0.18em] text-gold-soft transition hover:text-gold"
                      >
                        {rsvp ? "Edit RSVP" : "Send RSVP"}
                      </button>
                    ) : null
                  }
                >
                  <div className="rounded-2xl border border-gold/20 bg-white/[0.03] px-5 py-6">
                    {rsvpDone ? (
                      <p className="mb-4 font-body text-sm text-emerald-200">
                        {rsvpDone}
                      </p>
                    ) : null}
                    {rsvpError ? (
                      <p className="mb-4 font-body text-sm text-rose-200">
                        {rsvpError}
                      </p>
                    ) : null}

                    {editingRsvp ? (
                      <form onSubmit={saveRsvp} className="space-y-4">
                        <p className="font-body text-[11px] uppercase tracking-[0.22em] text-gold-soft">
                          {rsvp ? "Edit your RSVP" : "Send your RSVP"}
                        </p>
                        <label className="block">
                          <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                            Full name
                          </span>
                          <input
                            className={cn(fieldClass, "mt-2")}
                            value={rsvpName}
                            onChange={(event) => setRsvpName(event.target.value)}
                            required
                            minLength={2}
                          />
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="block">
                            <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                              Number of guests
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              className={cn(fieldClass, "mt-2")}
                              value={rsvpGuests}
                              onChange={(event) =>
                                setRsvpGuests(Number(event.target.value) || 1)
                              }
                              required
                            />
                          </label>
                          {!multiDayRsvp ? (
                            <label className="block">
                              <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                                Attendance
                                {siteDays[0] ? (
                                  <span className="normal-case tracking-normal text-muted/80">
                                    {" "}
                                    · {siteDays[0].date}
                                  </span>
                                ) : null}
                              </span>
                              <select
                                className={cn(fieldClass, "mt-2 appearance-none")}
                                value={rsvpAttendance}
                                onChange={(event) =>
                                  setRsvpAttendance(
                                    event.target.value as "yes" | "no" | "maybe",
                                  )
                                }
                              >
                                <option value="yes">Joyfully attending</option>
                                <option value="maybe">Hopefully attending</option>
                                <option value="no">Unable to attend</option>
                              </select>
                            </label>
                          ) : null}
                        </div>

                        {multiDayRsvp ? (
                          <div className="space-y-3 rounded-xl border border-gold/20 bg-[#120f16] p-4">
                            <p className="font-body text-[10px] uppercase tracking-[0.2em] text-gold/70">
                              Days
                            </p>
                            {siteDays.map((day) => (
                              <div
                                key={day.dateKey}
                                className="grid gap-2 border-t border-gold/10 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[1fr_auto] sm:items-center"
                              >
                                <div>
                                  <p className="font-body text-sm text-cream">
                                    {day.date}
                                    {day.label ? (
                                      <span className="text-muted">
                                        {" "}
                                        · {day.label}
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="mt-0.5 font-body text-xs text-muted">
                                    {day.eventNames.join(" · ")}
                                  </p>
                                </div>
                                <select
                                  className={cn(
                                    fieldClass,
                                    "appearance-none sm:min-w-[12rem]",
                                  )}
                                  value={rsvpDayAnswers[day.dateKey] || "yes"}
                                  onChange={(event) => {
                                    const value = event.target.value as
                                      | "yes"
                                      | "no"
                                      | "maybe";
                                    setRsvpDayAnswers((prev) => ({
                                      ...prev,
                                      [day.dateKey]: value,
                                    }));
                                  }}
                                  aria-label={`Attendance for ${day.date}`}
                                >
                                  <option value="yes">Joyfully attending</option>
                                  <option value="maybe">
                                    Hopefully attending
                                  </option>
                                  <option value="no">Unable to attend</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <label className="block">
                          <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                            Meal preference
                          </span>
                          <select
                            className={cn(fieldClass, "mt-2 appearance-none")}
                            value={rsvpMeal}
                            onChange={(event) =>
                              setRsvpMeal(
                                event.target.value as
                                  | "vegetarian"
                                  | "non-vegetarian"
                                  | "no-preference",
                              )
                            }
                          >
                            <option value="no-preference">No preference</option>
                            <option value="vegetarian">Vegetarian</option>
                            <option value="non-vegetarian">Non-vegetarian</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                            RSVP via
                          </span>
                          <select
                            className={cn(fieldClass, "mt-2 appearance-none")}
                            value={rsvpFamily}
                            onChange={(event) =>
                              setRsvpFamily(event.target.value)
                            }
                          >
                            <option value="">Select a family</option>
                            {familyOptions.map((family) => (
                              <option key={family.name} value={family.name}>
                                {family.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                            Message for the couple (optional)
                          </span>
                          <textarea
                            className={cn(fieldClass, "mt-2 min-h-24 resize-y")}
                            value={rsvpNotes}
                            onChange={(event) =>
                              setRsvpNotes(event.target.value)
                            }
                            maxLength={500}
                            placeholder="Blessings or a short note"
                          />
                        </label>

                        {data?.accommodation ? (
                          <p className="font-body text-xs text-muted">
                            Stay booking stays as-is — manage hotel details in{" "}
                            <button
                              type="button"
                              className="text-gold-soft underline-offset-2 hover:underline"
                              onClick={() => {
                                cancelEditRsvp();
                                setTab("booking");
                              }}
                            >
                              Stay booking
                            </button>
                            .
                          </p>
                        ) : null}

                        <div className="flex flex-wrap items-center gap-3">
                          <Button type="submit" disabled={rsvpBusy}>
                            {rsvpBusy
                              ? "Saving…"
                              : rsvp
                                ? "Save RSVP"
                                : "Send RSVP"}
                          </Button>
                          <button
                            type="button"
                            className="font-body text-xs uppercase tracking-[0.18em] text-muted transition hover:text-cream"
                            onClick={cancelEditRsvp}
                            disabled={rsvpBusy}
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : !rsvp ? (
                      <div>
                        <p className="font-body text-sm text-muted">
                          No RSVP submitted yet with this Google account.
                        </p>
                        {flagsReady && enabled("rsvp") ? (
                          <button
                            type="button"
                            onClick={() => startEditRsvp(null)}
                            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.16em] text-gold-soft transition hover:border-gold/50 hover:bg-gold/10"
                          >
                            <Pencil size={12} />
                            Send RSVP
                          </button>
                        ) : null}
                      </div>
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
                        {rsvp.name ? (
                          <p className="mt-3 font-body text-sm text-cream">
                            {rsvp.name}
                            {rsvp.contactFamily
                              ? ` · via ${rsvp.contactFamily}`
                              : ""}
                          </p>
                        ) : null}
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
                        {rsvp.notes ? (
                          <p className="mt-4 font-body text-sm leading-relaxed text-muted">
                            “{rsvp.notes}”
                          </p>
                        ) : null}
                        {flagsReady && enabled("rsvp") ? (
                          <div className="mt-5 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEditRsvp(rsvp)}
                              className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.16em] text-gold-soft transition hover:border-gold/50 hover:bg-gold/10"
                            >
                              <Pencil size={12} />
                              Edit RSVP
                            </button>
                            <Link
                              href={rsvpHref}
                              className="inline-flex items-center gap-1.5 rounded-full border border-gold/20 px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.16em] text-muted transition hover:border-gold/40 hover:text-cream"
                            >
                              Open full RSVP page
                            </Link>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </Panel>
              ) : null}

              {activeTab === "uploads" ? (
                <Panel
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
                        <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                </Panel>
              ) : null}

              {activeTab === "wishes" ? (
                <Panel
                  title="Your wishes"
                  subtitle="Write, edit, or remove your blessings. Edits go back to family review before they appear on the wall."
                  action={
                    <Link
                      href={wishHref}
                      className="font-body text-[11px] uppercase tracking-[0.18em] text-gold-soft transition hover:text-gold"
                    >
                      View wall
                    </Link>
                  }
                >
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-gold/20 bg-white/[0.03] px-5 py-6">
                      <div className="flex flex-wrap gap-3">
                        <StatusPill
                          label={`${wishes?.counts.total || 0} written`}
                          tone="muted"
                        />
                        {(wishes?.counts.pending || 0) > 0 ? (
                          <StatusPill
                            label={`${wishes?.counts.pending} in review`}
                            tone="amber"
                          />
                        ) : null}
                        {(wishes?.counts.approved || 0) > 0 ? (
                          <StatusPill
                            label={`${wishes?.counts.approved} on the wall`}
                            tone="green"
                          />
                        ) : null}
                        {(wishes?.remaining || 0) > 0 ? (
                          <StatusPill
                            label={`${wishes?.remaining} left`}
                            tone="muted"
                          />
                        ) : (
                          <StatusPill label="Limit reached" tone="amber" />
                        )}
                      </div>

                      {wishDone ? (
                        <p className="mt-4 font-body text-sm text-emerald-200">
                          {wishDone}
                        </p>
                      ) : null}
                      {wishError ? (
                        <p className="mt-4 font-body text-sm text-rose-200">
                          {wishError}
                        </p>
                      ) : null}

                      {!wishes || wishes.items.length === 0 ? (
                        <p className="mt-5 font-body text-sm text-muted">
                          You have not written a wish yet — add your first below.
                        </p>
                      ) : (
                        <ul className="mt-5 space-y-3">
                          {wishes.items.map((wish) => {
                            const meta = wishStatusMeta(wish.status);
                            const isEditing = editingWishId === wish.id;
                            const isRemoving = removingWishId === wish.id;
                            return (
                              <li
                                key={wish.id}
                                className="rounded-xl border border-gold/15 bg-[#120f16] px-4 py-4"
                              >
                                {isEditing ? (
                                  <form
                                    onSubmit={saveEditWish}
                                    className="space-y-4"
                                  >
                                    <p className="font-body text-[11px] uppercase tracking-[0.22em] text-gold-soft">
                                      Edit wish
                                    </p>
                                    <p className="font-body text-xs text-muted">
                                      Signed as {wishSignedAsName}
                                      {wishSignedAsEmail
                                        ? ` · ${wishSignedAsEmail}`
                                        : ""}
                                    </p>
                                    <label className="block">
                                      <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                                        Message / quote
                                      </span>
                                      <textarea
                                        className={cn(
                                          fieldClass,
                                          "mt-2 min-h-28 resize-y",
                                        )}
                                        value={editBody}
                                        onChange={(event) =>
                                          setEditBody(event.target.value)
                                        }
                                        maxLength={400}
                                        required
                                      />
                                      <span className="mt-1 block text-right font-body text-[11px] text-muted">
                                        {editBody.length}/400
                                      </span>
                                    </label>
                                    <div className="flex flex-wrap items-center gap-3">
                                      <Button
                                        type="submit"
                                        disabled={editBusy || !wishSignedAsEmail}
                                      >
                                        <Send size={15} />
                                        {editBusy ? "Saving…" : "Save changes"}
                                      </Button>
                                      <button
                                        type="button"
                                        className="font-body text-xs uppercase tracking-[0.18em] text-muted transition hover:text-cream"
                                        onClick={cancelEditWish}
                                        disabled={editBusy}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <StatusPill
                                        label={meta.label}
                                        tone={meta.tone}
                                      />
                                      <span className="font-body text-xs text-muted">
                                        {formatDate(wish.createdAt)}
                                      </span>
                                      <span className="font-body text-xs text-gold/70">
                                        — {wish.displayName}
                                      </span>
                                    </div>
                                    <p className="mt-3 font-display text-lg leading-relaxed text-cream">
                                      “{wish.body}”
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.16em] text-gold-soft transition hover:border-gold/50 hover:bg-gold/10"
                                        onClick={() => startEditWish(wish)}
                                        disabled={Boolean(removingWishId)}
                                      >
                                        <Pencil size={12} />
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/30 px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.16em] text-rose-200 transition hover:border-rose-300/50 hover:bg-rose-400/10"
                                        onClick={() => void removeWish(wish.id)}
                                        disabled={isRemoving || editBusy}
                                      >
                                        <Trash2 size={12} />
                                        {isRemoving ? "Removing…" : "Remove"}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    {(wishes?.remaining ?? 1) > 0 ? (
                      <form
                        onSubmit={sendWish}
                        className="rounded-2xl border border-gold/20 bg-white/[0.03] px-5 py-6"
                      >
                        <div className="flex items-center gap-2 text-gold-soft">
                          <Heart size={16} />
                          <p className="font-body text-[11px] uppercase tracking-[0.22em]">
                            Write another wish
                          </p>
                        </div>
                        <p className="mt-2 font-body text-sm text-muted">
                          Signed in as {wishSignedAsName}
                          {wishSignedAsEmail ? ` · ${wishSignedAsEmail}` : ""}.
                          You can send multiple wishes —{" "}
                          {wishes?.remaining ?? "several"} remaining.
                        </p>
                        {!wishSignedAsEmail ? (
                          <p className="mt-3 font-body text-sm text-rose-200">
                            Your Google account needs an email to share a wish.
                          </p>
                        ) : null}
                        <label className="mt-4 block">
                          <span className="font-body text-[10px] uppercase tracking-[0.18em] text-gold/70">
                            Message / quote
                          </span>
                          <textarea
                            className={cn(fieldClass, "mt-2 min-h-28 resize-y")}
                            value={wishBody}
                            onChange={(event) => setWishBody(event.target.value)}
                            maxLength={400}
                            required
                            placeholder="A blessing, a memory, or a quote for the bride and groom…"
                          />
                          <span className="mt-1 block text-right font-body text-[11px] text-muted">
                            {wishBody.length}/400
                          </span>
                        </label>
                        <div className="mt-5 flex flex-wrap items-center gap-4">
                          <Button
                            type="submit"
                            disabled={
                              wishBusy ||
                              Boolean(editingWishId) ||
                              !wishSignedAsEmail
                            }
                          >
                            <Send size={15} />
                            {wishBusy ? "Sending…" : "Share wish"}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <p className="rounded-2xl border border-amber-400/25 bg-amber-400/10 px-5 py-4 font-body text-sm text-amber-100/90">
                        You have reached the limit of {wishes?.maxPerGuest || 10}{" "}
                        wishes for this account.
                      </p>
                    )}
                  </div>
                </Panel>
              ) : null}

              {activeTab === "find-photos" ? (
                <Panel
                  title="Find my photos"
                  subtitle="Selfie match status for your private wedding album."
                  action={
                    <Link
                      href={photosHref}
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
                </Panel>
              ) : null}

              {activeTab === "query" ? (
                <Panel
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
                        <p className="font-body text-sm text-rose-200">
                          {queryError}
                        </p>
                      ) : null}
                    </div>
                  </form>
                </Panel>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
