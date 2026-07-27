"use client";

import { LogIn, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useGuestAuth } from "@/hooks/useGuestAuth";
import { cn } from "@/lib/utils";

type GuestNavAuthProps = {
  /** Compact header control vs full-width mobile menu row */
  variant?: "header" | "menu";
  onDone?: () => void;
};

export function GuestNavAuth({
  variant = "header",
  onDone,
}: GuestNavAuthProps) {
  const { configured, ready, user, busy, error, signIn, signOut } =
    useGuestAuth();
  const isMenu = variant === "menu";

  if (!ready) {
    return (
      <span
        className={cn(
          "inline-flex min-h-10 min-w-[5.5rem] items-center justify-center rounded-full border border-gold/20 px-3 font-body text-[11px] uppercase tracking-[0.18em] text-muted/70",
          isMenu ? "mt-2 w-full" : "",
        )}
      >
        …
      </span>
    );
  }

  if (user) {
    const label =
      user.displayName?.trim().split(/\s+/)[0] ||
      user.email?.split("@")[0] ||
      "Guest";

    return (
      <div
        className={cn(
          "flex items-center gap-2",
          isMenu
            ? "mt-5 w-full flex-col items-stretch gap-3 border-t border-gold/20 pt-5"
            : "",
        )}
      >
        <Link
          href="/my-account"
          onClick={() => onDone?.()}
          className={cn(
            "group flex min-w-0 items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-2 transition hover:border-gold/55 hover:bg-gold/20",
            isMenu ? "w-full justify-start px-4 py-3.5" : "min-h-10",
          )}
          title="Open your booking, RSVP, and uploads"
        >
          <UserRound size={14} className="shrink-0 text-gold-soft" />
          <span className="min-w-0 text-left">
            <span className="block font-body text-[9px] uppercase tracking-[0.18em] text-gold/80">
              My account
            </span>
            <span
              className={cn(
                "block truncate font-body text-sm text-cream group-hover:text-gold-soft",
                isMenu ? "" : "max-w-[7rem] sm:max-w-[9rem]",
              )}
            >
              {label}
            </span>
          </span>
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void signOut().then(() => onDone?.());
          }}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full border border-gold/40 bg-[#141018] px-3 py-2.5 font-body text-[11px] uppercase tracking-[0.18em] text-gold-soft shadow-[0_0_0_1px_rgba(196,163,90,0.15)] transition hover:bg-gold/15 disabled:opacity-60 sm:px-4",
            isMenu ? "w-full py-3.5 text-xs" : "min-h-10",
          )}
        >
          <LogOut size={14} />
          {busy ? "…" : "Log out"}
        </button>
        {error ? (
          <p className="font-body text-[11px] text-rose-200">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-stretch",
        isMenu ? "mt-5 w-full border-t border-gold/20 pt-5" : "",
      )}
    >
      <button
        type="button"
        disabled={busy || !configured}
        onClick={() => {
          if (!configured) return;
          void signIn().then((nextUser) => {
            if (nextUser) onDone?.();
          });
        }}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full border border-gold/50 bg-gradient-to-r from-gold-deep via-gold to-gold-soft px-4 py-2.5 font-body text-[11px] font-medium uppercase tracking-[0.18em] text-[#1a1208] shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60",
          isMenu ? "w-full py-3.5 text-xs" : "min-h-10",
        )}
        title={
          configured
            ? "Sign in with Google"
            : "Google sign-in is not configured yet"
        }
      >
        <LogIn size={14} />
        {busy ? "Opening Google…" : "Log in"}
      </button>
      {!configured ? (
        <p
          className={cn(
            "font-body text-[10px] text-amber-200/90",
            isMenu ? "mt-2" : "mt-1 max-w-[9rem] sm:max-w-none",
          )}
        >
          Sign-in not configured
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 font-body text-[11px] text-rose-200">{error}</p>
      ) : null}
    </div>
  );
}
