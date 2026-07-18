"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarDays, Images, LogOut } from "lucide-react";
import type { GalleryImage, ManagedEvent } from "@/lib/types";
import { EventsManager } from "@/components/dashboard/EventsManager";
import { GalleryManager } from "@/components/dashboard/GalleryManager";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  events: ManagedEvent[];
  gallery: GalleryImage[];
};

type Tab = "events" | "gallery";

export function DashboardShell({ events, gallery }: DashboardShellProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("gallery");

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
        <div className="mb-8 flex gap-2 rounded-full border border-gold/20 bg-[#141018] p-1 w-fit">
          {(
            [
              ["gallery", "Upload Images", Images],
              ["events", "Events", CalendarDays],
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
            </button>
          ))}
        </div>

        {tab === "events" ? (
          <EventsManager initialEvents={events} />
        ) : (
          <GalleryManager initialGallery={gallery} />
        )}
      </div>
    </div>
  );
}
