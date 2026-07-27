"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Heart,
  Images,
  LogOut,
  Mail,
  Menu,
  ScanFace,
  Settings2,
  Shield,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type {
  AccommodationRequest,
  AdminPermission,
  GalleryImage,
  ManagedEvent,
  RoomInventory,
  RsvpEntry,
} from "@/lib/types";
import { AccommodationManager } from "@/components/dashboard/AccommodationManager";
import { ChangePinForm } from "@/components/dashboard/ChangePinForm";
import { FeatureFlagsManager } from "@/components/dashboard/FeatureFlagsManager";
import { FacesManager } from "@/components/dashboard/FacesManager";
import { RsvpBannerManager } from "@/components/dashboard/RsvpBannerManager";
import { EmailLogManager } from "@/components/dashboard/EmailLogManager";
import { EventsManager } from "@/components/dashboard/EventsManager";
import { GalleryManager } from "@/components/dashboard/GalleryManager";
import { GuestLoginsManager } from "@/components/dashboard/GuestLoginsManager";
import { GuestPhotoReview } from "@/components/dashboard/GuestPhotoReview";
import { GuestWishesReview } from "@/components/dashboard/GuestWishesReview";
import { RsvpManager } from "@/components/dashboard/RsvpManager";
import { StorageBanner } from "@/components/dashboard/StorageBanner";
import { TeamManager } from "@/components/dashboard/TeamManager";
import { cn } from "@/lib/utils";

export type DashboardSession = {
  kind: "master" | "member";
  name: string;
  permissions: AdminPermission[];
};

type DashboardShellProps = {
  session: DashboardSession;
  events: ManagedEvent[];
  gallery: GalleryImage[];
  rsvps: RsvpEntry[];
  accommodations: AccommodationRequest[];
  inventory?: RoomInventory;
  loadError?: string;
};

type Tab =
  | "rsvp"
  | "stay"
  | "events"
  | "upload"
  | "review"
  | "faces"
  | "guests"
  | "wishes"
  | "team"
  | "emails"
  | "settings";

type NavItem = {
  id: Tab;
  label: string;
  Icon: typeof Users;
  count: number;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

const SIDEBAR_KEY = "swaneet-dashboard-sidebar";

function can(session: DashboardSession, permission: AdminPermission) {
  if (session.kind === "master") return true;
  return session.permissions.includes(permission);
}

export function DashboardShell({
  session,
  events,
  gallery,
  rsvps,
  accommodations,
  inventory,
  loadError,
}: DashboardShellProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_KEY);
      if (saved === "0") setSidebarOpen(false);
      if (saved === "1") setSidebarOpen(true);
    } catch {
      // ignore
    }
  }, []);

  const setSidebar = (open: boolean) => {
    setSidebarOpen(open);
    try {
      localStorage.setItem(SIDEBAR_KEY, open ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const navGroups = useMemo(() => {
    const groups: NavGroup[] = [];

    const stayItems: NavItem[] = [];
    if (can(session, "rsvp")) {
      stayItems.push({
        id: "rsvp",
        label: "RSVPs",
        Icon: Users,
        count: rsvps.length,
      });
    }
    if (can(session, "stay")) {
      stayItems.push({
        id: "stay",
        label: "Accommodation",
        Icon: BedDouble,
        count: accommodations.length,
      });
    }
    if (stayItems.length) {
      groups.push({ id: "stay", label: "Guests & stay", items: stayItems });
    }

    const mediaItems: NavItem[] = [];
    if (can(session, "gallery_upload")) {
      mediaItems.push({
        id: "upload",
        label: "Upload media",
        Icon: Images,
        count: 0,
      });
    }
    if (can(session, "gallery_review")) {
      mediaItems.push({
        id: "review",
        label: "Review photos",
        Icon: ClipboardCheck,
        count: gallery.filter((g) => g.status === "pending").length,
      });
    }
    if (can(session, "faces")) {
      mediaItems.push({
        id: "faces",
        label: "Faces",
        Icon: ScanFace,
        count: 0,
      });
    }
    if (mediaItems.length) {
      groups.push({ id: "media", label: "Photos & faces", items: mediaItems });
    }

    const weddingItems: NavItem[] = [];
    if (can(session, "events")) {
      weddingItems.push({
        id: "events",
        label: "Events",
        Icon: CalendarDays,
        count: 0,
      });
    }
    if (weddingItems.length) {
      groups.push({ id: "wedding", label: "Wedding", items: weddingItems });
    }

    const peopleItems: NavItem[] = [];
    if (can(session, "guests")) {
      peopleItems.push({
        id: "guests",
        label: "Guest analytics",
        Icon: UserRound,
        count: 0,
      });
    }
    if (can(session, "messages")) {
      peopleItems.push({
        id: "wishes",
        label: "Wishes",
        Icon: Heart,
        count: 0,
      });
    }
    if (session.kind === "master") {
      peopleItems.push({
        id: "team",
        label: "Team access",
        Icon: Shield,
        count: 0,
      });
    }
    if (peopleItems.length) {
      groups.push({ id: "people", label: "People", items: peopleItems });
    }

    const settingsItems: NavItem[] = [];
    if (session.kind === "master") {
      settingsItems.push({
        id: "emails",
        label: "Email log",
        Icon: Mail,
        count: 0,
      });
      settingsItems.push({
        id: "settings",
        label: "Settings",
        Icon: Settings2,
        count: 0,
      });
    }
    if (settingsItems.length) {
      groups.push({ id: "settings", label: "Settings", items: settingsItems });
    }

    return groups;
  }, [session, rsvps.length, accommodations.length, gallery]);

  const flatTabs = useMemo(
    () => navGroups.flatMap((group) => group.items),
    [navGroups],
  );

  const [tab, setTab] = useState<Tab>(flatTabs[0]?.id || "rsvp");
  const activeTab = flatTabs.some((t) => t.id === tab)
    ? tab
    : flatTabs[0]?.id;

  const activeLabel =
    flatTabs.find((item) => item.id === activeTab)?.label || "Dashboard";

  const selectTab = (id: Tab) => {
    setTab(id);
    setMobileNavOpen(false);
  };

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.refresh();
  };

  const navButton = (item: NavItem, compact: boolean) => {
    const { id, label, Icon, count } = item;
    const active = activeTab === id;
    return (
      <button
        key={id}
        type="button"
        title={label}
        onClick={() => selectTab(id)}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm transition",
          compact ? "justify-center px-2" : "",
          active
            ? "bg-gold/15 text-gold-soft"
            : "text-muted hover:bg-white/5 hover:text-cream",
        )}
      >
        <Icon size={16} className="shrink-0" />
        {!compact ? (
          <>
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            {count > 0 ? (
              <span className="rounded-full bg-[#0d0b10] px-1.5 py-0.5 font-body text-[10px] text-cream/80">
                {count}
              </span>
            ) : null}
          </>
        ) : count > 0 ? (
          <span className="sr-only">{count}</span>
        ) : null}
      </button>
    );
  };

  const sidebarContent = (compact: boolean) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "border-b border-gold/15 px-4 py-4",
          compact ? "px-2 text-center" : "",
        )}
      >
        {!compact ? (
          <>
            <p className="font-body text-[10px] uppercase tracking-[0.32em] text-gold/70">
              #Swaneet
            </p>
            <p className="mt-1 font-display text-xl text-cream">Dashboard</p>
            <p className="mt-1 font-body text-[11px] text-muted">
              {session.name}
              {session.kind === "master" ? " · Master" : " · Team"}
            </p>
          </>
        ) : (
          <p className="font-display text-lg text-gold-soft">#S</p>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
        {navGroups.map((group) => (
          <div key={group.id}>
            {!compact ? (
              <p className="mb-1.5 px-3 font-body text-[10px] uppercase tracking-[0.22em] text-gold/55">
                {group.label}
              </p>
            ) : (
              <div className="mx-auto mb-1.5 h-px w-6 bg-gold/20" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => navButton(item, compact))}
            </div>
          </div>
        ))}
        {navGroups.length === 0 ? (
          <p className="px-3 font-body text-xs text-muted">
            No permissions assigned.
          </p>
        ) : null}
      </nav>

      <div
        className={cn(
          "space-y-1 border-t border-gold/15 px-2 py-3",
          compact ? "px-1" : "",
        )}
      >
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm text-muted hover:bg-white/5 hover:text-cream",
            compact ? "justify-center px-2" : "",
          )}
          title="View site"
        >
          {!compact ? "View site" : <span className="text-xs">Site</span>}
        </Link>
        <button
          type="button"
          onClick={logout}
          title="Logout"
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 font-body text-sm text-muted hover:bg-white/5 hover:text-cream",
            compact ? "justify-center px-2" : "",
          )}
        >
          <LogOut size={16} className="shrink-0" />
          {!compact ? "Logout" : null}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#07060a] text-cream">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-screen shrink-0 border-r border-gold/15 bg-[#0d0b10] transition-[width] duration-200 lg:block",
            sidebarOpen ? "w-64" : "w-[4.5rem]",
          )}
        >
          {sidebarContent(!sidebarOpen)}
          <button
            type="button"
            onClick={() => setSidebar(!sidebarOpen)}
            className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-gold/30 bg-[#141018] text-gold-soft hover:bg-gold/15"
            title={sidebarOpen ? "Hide menu" : "Show menu"}
            aria-label={sidebarOpen ? "Hide side menu" : "Show side menu"}
          >
            {sidebarOpen ? (
              <ChevronLeft size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
        </aside>

        {/* Mobile drawer */}
        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Close menu"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-[min(18rem,88vw)] flex-col border-r border-gold/15 bg-[#0d0b10] shadow-2xl">
              <div className="flex items-center justify-between border-b border-gold/15 px-4 py-3">
                <p className="font-display text-lg text-cream">Menu</p>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-full border border-gold/25 p-2 text-gold-soft"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {sidebarContent(false)}
              </div>
            </aside>
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-gold/15 bg-[#07060a]/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="rounded-full border border-gold/25 p-2 text-gold-soft lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setSidebar(!sidebarOpen)}
                  className="hidden rounded-full border border-gold/25 p-2 text-gold-soft hover:bg-gold/10 lg:inline-flex"
                  title={sidebarOpen ? "Hide menu" : "Show menu"}
                  aria-label={
                    sidebarOpen ? "Hide side menu" : "Show side menu"
                  }
                >
                  <Menu size={16} />
                </button>
                <div className="min-w-0">
                  <p className="font-body text-[10px] uppercase tracking-[0.28em] text-gold/70">
                    {session.kind === "master" ? "Master" : "Team"}
                  </p>
                  <h1 className="truncate font-display text-xl text-cream sm:text-2xl">
                    {activeLabel}
                  </h1>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <Link
                  href="/"
                  className="hidden font-body text-xs uppercase tracking-[0.2em] text-muted hover:text-gold-soft sm:inline"
                >
                  View site
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-2 rounded-full border border-gold/25 px-3 py-2 font-body text-xs uppercase tracking-[0.18em] text-gold-soft hover:bg-gold/10 sm:px-4"
                >
                  <LogOut size={14} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            </div>
          </header>

          <div className="px-4 py-6 sm:px-6 lg:px-8">
            {loadError ? (
              <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 font-body text-sm text-red-100">
                {loadError}
              </div>
            ) : null}
            {session.kind === "master" ? <StorageBanner /> : null}

            {activeTab === "rsvp" ? (
              <RsvpManager initialRsvps={rsvps} />
            ) : activeTab === "stay" ? (
              <AccommodationManager
                initialAccommodations={accommodations}
                initialInventory={inventory}
              />
            ) : activeTab === "events" ? (
              <EventsManager initialEvents={events} />
            ) : activeTab === "upload" ? (
              <GalleryManager
                initialGallery={gallery}
                events={events}
                canManageFaces={can(session, "faces")}
                onOpenFaces={
                  can(session, "faces") ? () => setTab("faces") : undefined
                }
              />
            ) : activeTab === "review" ? (
              <GuestPhotoReview
                initialGallery={gallery}
                events={events}
                canManageFaces={can(session, "faces")}
              />
            ) : activeTab === "faces" ? (
              <FacesManager />
            ) : activeTab === "guests" ? (
              <GuestLoginsManager />
            ) : activeTab === "wishes" ? (
              <GuestWishesReview />
            ) : activeTab === "team" ? (
              <TeamManager />
            ) : activeTab === "emails" ? (
              <EmailLogManager />
            ) : activeTab === "settings" ? (
              <div className="space-y-8">
                <div>
                  <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
                    Settings
                  </p>
                  <h2 className="mt-1 font-display text-2xl text-cream">
                    Site & access controls
                  </h2>
                  <p className="mt-1 font-body text-sm text-muted">
                    PIN, feature flags, and RSVP banner — room assignment stays
                    under Accommodation.
                  </p>
                </div>
                <ChangePinForm />
                <FeatureFlagsManager />
                <RsvpBannerManager />
              </div>
            ) : (
              <p className="font-body text-sm text-muted">
                No permissions assigned. Ask Master to update your role.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
