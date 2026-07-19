"use client";

import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { wedding } from "@/data/wedding";
import { cn } from "@/lib/utils";

const links = [
  { href: "#countdown", label: "Countdown" },
  { href: "#story", label: "Story" },
  { href: "#events", label: "Events" },
  { href: "#venue", label: "Venue" },
  { href: "#gallery", label: "Gallery" },
  { href: "#family", label: "Family" },
  { href: "#rsvp", label: "RSVP" },
  { href: "#share-photos", label: "Share" },
];

export function Navigation() {
  const [open, setOpen] = useState(false);

  return (
    <motion.header
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.4, duration: 0.7 }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
        <a
          href="#hero"
          className="font-script text-2xl text-gold-soft transition hover:text-gold"
        >
          {wedding.hashtag}
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="font-body text-[11px] uppercase tracking-[0.22em] text-muted transition hover:text-gold-soft"
            >
              {link.label}
            </a>
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
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="font-body text-sm uppercase tracking-[0.2em] text-cream"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </motion.header>
  );
}
