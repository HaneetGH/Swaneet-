"use client";

import { LogIn, LogOut } from "lucide-react";
import { useGuestAuth } from "@/hooks/useGuestAuth";
import { cn } from "@/lib/utils";

type GuestNavAuthProps = {
  /** Compact for desktop header; stack for mobile drawer */
  variant?: "desktop" | "mobile";
  onDone?: () => void;
};

export function GuestNavAuth({
  variant = "desktop",
  onDone,
}: GuestNavAuthProps) {
  const { configured, ready, user, busy, error, signIn, signOut } =
    useGuestAuth();

  if (!configured) {
    return null;
  }

  if (!ready) {
    return (
      <span
        className={cn(
          "font-body text-[11px] uppercase tracking-[0.18em] text-muted/70",
          variant === "mobile" ? "mt-2" : "",
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
          variant === "desktop"
            ? "flex items-center gap-2 sm:gap-3 sm:border-l sm:border-gold/20 sm:pl-5"
            : "mt-5 space-y-3 border-t border-gold/20 pt-5",
        )}
      >
        <div className={variant === "desktop" ? "hidden sm:block" : ""}>
          <p className="font-body text-[10px] uppercase tracking-[0.2em] text-gold/70">
            Signed in
          </p>
          <p
            className={cn(
              "truncate font-body text-sm text-cream",
              variant === "desktop" ? "max-w-[7rem] lg:max-w-[9rem]" : "",
            )}
            title={user.email || label}
          >
            {label}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void signOut().then(() => onDone?.());
          }}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-3 py-2 font-body text-[11px] uppercase tracking-[0.18em] text-gold-soft transition hover:bg-gold/20 disabled:opacity-60 sm:px-4",
            variant === "mobile" ? "w-full py-3" : "",
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
        variant === "desktop"
          ? "flex items-center sm:border-l sm:border-gold/20 sm:pl-5"
          : "mt-5 space-y-3 border-t border-gold/20 pt-5",
      )}
    >
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void signIn().then((nextUser) => {
            if (nextUser) onDone?.();
          });
        }}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full border border-gold/40 bg-gradient-to-r from-gold-deep via-gold to-gold-soft px-3 py-2 font-body text-[11px] uppercase tracking-[0.18em] text-[#1a1208] transition hover:brightness-110 disabled:opacity-60 sm:px-4",
          variant === "mobile" ? "w-full py-3" : "",
        )}
      >
        <LogIn size={14} />
        {busy ? "…" : "Log in"}
      </button>
      {error ? (
        <p className="mt-2 font-body text-[11px] text-rose-200">{error}</p>
      ) : null}
    </div>
  );
}
