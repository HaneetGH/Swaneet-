"use client";

import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { wedding } from "@/data/wedding";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useInvite } from "@/lib/invite-context";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

export function Navigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const invite = useInvite();
  const { enabled, ready } = useFeatureFlags();
  const onHome = pathname === "/";

  const links = useMemo(() => {
    const base: NavLink[] = invite
      ? [
          { href: "#countdown", label: "Countdown" },
          { href: "#events", label: "Events" },
          { href: "#venue", label: "Venue" },
          { href: "/gallery", label: "Gallery" },
          { href: "#family", label: "Family" },
        ]
      : [
          { href: "#countdown", label: "Countdown" },
          { href: "#story", label: "Story" },
          { href: "#events", label: "Events" },
          { href: "#venue", label: "Venue" },
          { href: "/gallery", label: "Gallery" },
          { href: "#family", label: "Family" },
        ];

    if (!ready || enabled("rsvp")) {
      base.push({ href: "#rsvp", label: "RSVP" });
    }
    if (!ready || enabled("guest_photos")) {
      base.push({ href: "#share-photos", label: "Upload" });
    }
    if (ready && enabled("face_find")) {
      base.push({ href: "/my-photos", label: "Find mine" });
    }
    return base;
  }, [enabled, invite, ready]);

  const resolveHref = (href: string) => {
    if (href.startsWith("/")) return href;
    if (invite) return `${invite.basePath}${href}`;
    return onHome ? href : `/${href}`;
  };

  const brandHref = useMemo(() => {
    if (invite) return `${invite.basePath}#hero`;
    return onHome ? "#hero" : "/";
  }, [invite, onHome]);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.7 }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <Link
          href={brandHref}
          className="font-script text-2xl text-gold-soft transition hover:text-gold"
        >
          {wedding.hashtag}
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {links.map((link) => (
            <Link
              key={link.href}
              href={resolveHref(link.href)}
              className="font-body text-[11px] uppercase tracking-[0.22em] text-muted transition hover:text-gold-soft"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="glass gold-border flex h-10 w-10 items-center justify-center rounded-full text-gold-soft lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <div
        className={cn(
          "glass border-t border-gold/20 px-5 py-6 lg:hidden",
          open ? "block" : "hidden",
        )}
      >
        <nav className="flex flex-col gap-4" aria-label="Mobile">
          {links.map((link) => (
            <Link
              key={link.href}
              href={resolveHref(link.href)}
              onClick={() => setOpen(false)}
              className="font-body text-sm uppercase tracking-[0.2em] text-cream"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </motion.header>
  );
}
