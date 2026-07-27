"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Heart, Quote, ScanFace, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useInvite } from "@/lib/invite-context";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "swaneet-welcome-v1";

type Action = {
  id: string;
  href: string;
  eyebrow: string;
  title: string;
  hint: string;
  icon: typeof Heart;
};

export function GuestWelcomeGuide() {
  const pathname = usePathname();
  const invite = useInvite();
  const { enabled, ready } = useFeatureFlags();
  const [visible, setVisible] = useState(false);

  const skipPage =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/shared-photos") ||
    pathname?.startsWith("/my-account");

  const actions = useMemo(() => {
    const base = invite?.basePath || "";
    const items: Action[] = [];

    if (!ready || enabled("rsvp")) {
      items.push({
        id: "rsvp",
        href: `${base}#rsvp`,
        eyebrow: "Reply",
        title: "RSVP",
        hint: "Say you’re coming — and if you need a stay",
        icon: Heart,
      });
    }

    if (!ready || enabled("guest_messages")) {
      items.push({
        id: "wishes",
        href: `${base}#wishes`,
        eyebrow: "Bless",
        title: "Leave a wish",
        hint: "A quote or message for the bride and groom",
        icon: Quote,
      });
    }

    if (!ready || enabled("guest_photos")) {
      items.push({
        id: "share",
        href: `${base}#share-photos`,
        eyebrow: "Upload",
        title: "Share a photo you took",
        hint: "Family reviews it before it appears in the gallery",
        icon: Camera,
      });
    }

    if (ready && enabled("face_find")) {
      items.push({
        id: "find",
        href: "/my-photos",
        eyebrow: "Your album",
        title: "Find photos of you",
        hint: "Sign in, upload a selfie — we’ll match pictures of you",
        icon: ScanFace,
      });
    }

    return items;
  }, [enabled, invite?.basePath, ready]);

  useEffect(() => {
    if (skipPage || !ready || actions.length === 0) return;
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // private mode — still show once this session
    }
    const timer = window.setTimeout(() => setVisible(true), 700);
    return () => window.clearTimeout(timer);
  }, [actions.length, ready, skipPage]);

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  if (skipPage || actions.length === 0) return null;

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-[#07060a]/72 p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="guest-welcome-title"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Dismiss welcome guide"
            onClick={dismiss}
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.35 }}
            className="relative z-10 w-full max-w-md border border-gold/30 bg-[#120e16] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:px-6"
          >
            <button
              type="button"
              onClick={dismiss}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center text-muted transition hover:text-cream"
              aria-label="Close"
            >
              <X size={18} />
            </button>

            <p className="font-body text-[10px] uppercase tracking-[0.32em] text-gold/70">
              First visit
            </p>
            <h2
              id="guest-welcome-title"
              className="mt-2 font-display text-3xl text-cream"
            >
              {actions.length === 1
                ? "Here’s what you can do"
                : actions.length === 2
                  ? "Two things you can do"
                  : `${actions.length} things you can do`}
            </h2>
            <p className="mt-2 font-body text-sm leading-relaxed text-muted">
              Use the same Google account for gallery, uploads, and finding your
              photos.
            </p>

            <ul className="mt-5 space-y-2">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <li key={action.id}>
                    <Link
                      href={action.href}
                      onClick={dismiss}
                      className={cn(
                        "flex items-start gap-3 border border-gold/20 bg-[#0d0b10] px-3.5 py-3.5 transition",
                        "hover:border-gold/45 hover:bg-gold/5",
                      )}
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center border border-gold/30 bg-gold/10 text-gold-soft">
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 text-left">
                        <span className="block font-body text-[10px] uppercase tracking-[0.24em] text-gold/70">
                          {action.eyebrow}
                        </span>
                        <span className="mt-0.5 block font-display text-xl text-cream">
                          {action.title}
                        </span>
                        <span className="mt-0.5 block font-body text-xs text-muted">
                          {action.hint}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <button
              type="button"
              onClick={dismiss}
              className="mt-5 w-full border border-gold/25 py-3 font-body text-[11px] uppercase tracking-[0.22em] text-muted transition hover:border-gold/40 hover:text-cream"
            >
              I’ll explore on my own
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
