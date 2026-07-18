"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Images, KeyRound, LogOut, Users } from "lucide-react";
import type { GalleryImage, ManagedEvent, RsvpEntry } from "@/lib/types";
import { ChangePinForm } from "@/components/dashboard/ChangePinForm";
import { EventsManager } from "@/components/dashboard/EventsManager";
import { GalleryManager } from "@/components/dashboard/GalleryManager";
import { RsvpManager } from "@/components/dashboard/RsvpManager";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  events: ManagedEvent[];
  gallery: GalleryImage[];
  rsvps: RsvpEntry[];
};

type Tab = "rsvp" | "events" | "gallery" | "settings";

export function DashboardShell({
  events,
  gallery,
  rsvps,
}: DashboardShellProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("rsvp");

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
        <div className="mb-8 flex flex-wrap gap-2 rounded-full border border-gold/20 bg-[#141018] p-1 w-fit">
          {(
            [
              ["rsvp", "RSVPs", Users],
              ["gallery", "Upload Images", Images],
              ["events", "Events", CalendarDays],
              ["settings", "PIN", KeyRound],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-5 py-2.5 font-body text-xs uppercase tracking-[0.18em] transition",
                tab === id
                  ? "bg-gradient-to-r from-gold-deep via-gold to-gold-soft text-[#1a1208]"
                  : "text-muted hover:text-cream",
              )}
            >
              <Icon size={14} />
              {label}
              {id === "rsvp" && rsvps.length > 0 ? (
                <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[10px]">
                  {rsvps.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {tab === "rsvp" ? (
          <RsvpManager initialRsvps={rsvps} />
        ) : tab === "events" ? (
          <EventsManager initialEvents={events} />
        ) : tab === "gallery" ? (
          <GalleryManager initialGallery={gallery} />
        ) : (
          <ChangePinForm />
        )}
      </div>
    </div>
  );
}
