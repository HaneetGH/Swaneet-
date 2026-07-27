"use client";

import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { GuestNavAuth } from "@/components/layout/GuestNavAuth";
import { wedding } from "@/data/wedding";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { guestActionPath } from "@/lib/guest-paths";
import { useInvite } from "@/lib/invite-context";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };

export function Navigation() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const invite = useInvite();
  const { enabled, ready } = useFeatureFlags();
  const onMainHome = pathname === "/";

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

    if (!ready || enabled("guest_messages")) {
      base.push({ href: guestActionPath("/wishes", invite), label: "Wishes" });
    }
    if (!ready || enabled("rsvp")) {
      base.push({ href: guestActionPath("/rsvp", invite), label: "RSVP" });
    }
    if (!ready || enabled("guest_photos")) {
      base.push({ href: guestActionPath("/upload", invite), label: "Upload" });
    }
    if (ready && enabled("face_find")) {
      base.push({ href: "/my-photos", label: "Find mine" });
    }
    // My account lives in the header auth chip — avoid a duplicate nav link
    return base;
  }, [enabled, invite, ready]);

  const resolveHref = (href: string) => {
    if (href.startsWith("/")) return href;
    if (invite) return `${invite.basePath}${href}`;
    return onMainHome ? href : `/${href}`;
  };

  const brandHref = useMemo(() => {
    if (invite) return `${invite.basePath}#hero`;
    return onMainHome ? "#hero" : "/";
  }, [invite, onMainHome]);

  const isActive = (href: string) => {
    if (href.startsWith("/")) return pathname === href;
    return false;
  };

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.7 }}
      className="fixed inset-x-0 top-0 z-50 border-b border-gold/10 bg-[#07060a]/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8">
        <Link
          href={brandHref}
          className="relative z-10 shrink-0 bg-[#07060a]/80 pr-3 font-script text-2xl text-gold-soft transition hover:text-gold"
        >
          {wedding.hashtag}
        </Link>

        {/* Full link row only when there is room — never a horizontal slider */}
        <nav
          className="hidden items-center justify-end gap-3 xl:flex 2xl:gap-5"
          aria-label="Primary"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={resolveHref(link.href)}
              className={cn(
                "font-body text-[10px] uppercase tracking-[0.18em] transition hover:text-gold-soft 2xl:text-[11px] 2xl:tracking-[0.2em]",
                isActive(link.href) ? "text-gold-soft" : "text-muted",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Always-visible account control (desktop + mobile) */}
        <div className="flex shrink-0 items-center gap-2 border-l border-gold/25 pl-3 sm:pl-4">
          <GuestNavAuth variant="header" />
          <button
            type="button"
            className="glass gold-border flex h-10 w-10 items-center justify-center rounded-full text-gold-soft xl:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <div
        className={cn(
          "glass border-t border-gold/20 px-5 py-6 xl:hidden",
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
          <GuestNavAuth variant="menu" onDone={() => setOpen(false)} />
        </nav>
      </div>
    </motion.header>
  );
}
