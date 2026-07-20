"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BedDouble,
  CalendarDays,
  ClipboardCheck,
  Images,
  KeyRound,
  LogOut,
  Mail,
  Shield,
  UserRound,
  Users,
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
import { EmailLogManager } from "@/components/dashboard/EmailLogManager";
import { EventsManager } from "@/components/dashboard/EventsManager";
import { GalleryManager } from "@/components/dashboard/GalleryManager";
import { GuestLoginsManager } from "@/components/dashboard/GuestLoginsManager";
import { GuestPhotoReview } from "@/components/dashboard/GuestPhotoReview";
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
  | "guests"
  | "team"
  | "emails"
  | "settings";

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

  const tabs = useMemo(() => {
    const items: Array<{
      id: Tab;
      label: string;
      Icon: typeof Users;
      count: number;
    }> = [];
    if (can(session, "rsvp")) {
      items.push({ id: "rsvp", label: "RSVPs", Icon: Users, count: rsvps.length });
    }
    if (can(session, "stay")) {
      items.push({
        id: "stay",
        label: "Stay",
        Icon: BedDouble,
        count: accommodations.length,
      });
    }
    if (can(session, "gallery_upload")) {
      items.push({
        id: "upload",
        label: "Upload media",
        Icon: Images,
        count: 0,
      });
    }
    if (can(session, "gallery_review")) {
      items.push({
        id: "review",
        label: "Review photos",
        Icon: ClipboardCheck,
        count: gallery.filter((g) => g.status === "pending").length,
      });
    }
    if (can(session, "events")) {
      items.push({ id: "events", label: "Events", Icon: CalendarDays, count: 0 });
    }
    if (can(session, "guests")) {
      items.push({ id: "guests", label: "Guests", Icon: UserRound, count: 0 });
    }
    if (session.kind === "master") {
      items.push({ id: "team", label: "Team", Icon: Shield, count: 0 });
      items.push({ id: "emails", label: "Email status", Icon: Mail, count: 0 });
      items.push({ id: "settings", label: "Master PIN", Icon: KeyRound, count: 0 });
    }
    return items;
  }, [session, rsvps.length, accommodations.length, gallery]);

  const [tab, setTab] = useState<Tab>(tabs[0]?.id || "rsvp");

  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id;

  const logout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-[#07060a] text-cream">
      <header className="border-b border-gold/15">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <p className="font-body text-[10px] uppercase tracking-[0.35em] text-gold/70">
              #Swaneet
            </p>
            <h1 className="font-display text-2xl text-cream">Wedding Dashboard</h1>
            <p className="mt-1 font-body text-xs text-muted">
              Signed in as {session.name}
              {session.kind === "master" ? " · Master" : " · Team"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden font-body text-xs uppercase tracking-[0.2em] text-muted hover:text-gold-soft sm:inline"
            >
              View site
            </Link>
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full border border-gold/25 px-4 py-2 font-body text-xs uppercase tracking-[0.18em] text-gold-soft hover:bg-gold/10"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {loadError ? (
          <div className="mb-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-4 py-3 font-body text-sm text-red-100">
            {loadError}
          </div>
        ) : null}
        {session.kind === "master" ? <StorageBanner /> : null}
        <div className="mb-8 flex w-fit flex-wrap gap-2 rounded-full border border-gold/20 bg-[#141018] p-1">
          {tabs.map(({ id, label, Icon, count }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-body text-xs uppercase tracking-[0.18em] transition",
                activeTab === id
                  ? "bg-gradient-to-r from-gold-deep via-gold to-gold-soft text-[#1a1208]"
                  : "text-muted hover:text-cream",
              )}
            >
              <Icon size={14} />
              {label}
              {count > 0 ? (
                <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">
                  {count}
                </span>
              ) : null}
            </button>
          ))}
        </div>

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
          <GalleryManager initialGallery={gallery} events={events} />
        ) : activeTab === "review" ? (
          <GuestPhotoReview initialGallery={gallery} events={events} />
        ) : activeTab === "guests" ? (
          <GuestLoginsManager />
        ) : activeTab === "team" ? (
          <TeamManager />
        ) : activeTab === "emails" ? (
          <EmailLogManager />
        ) : activeTab === "settings" ? (
          <ChangePinForm />
        ) : (
          <p className="font-body text-sm text-muted">
            No permissions assigned. Ask Master to update your role.
          </p>
        )}
      </div>
    </div>
  );
}
