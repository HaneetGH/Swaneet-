"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import {
  getFirebaseAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import { trackGuestActivity } from "@/lib/guest-activity";
import { Button } from "@/components/ui/Button";

type GuestAuthPanelProps = {
  onAuthed: (user: User) => void;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
};

export function GuestAuthPanel({
  onAuthed,
  title = "Request accommodation",
  subtitle = "Sign in with Google to share stay details. We’ll use your email for confirmation.",
  ctaLabel = "Continue with Google",
}: GuestAuthPanelProps) {
  const [configured] = useState(() => isFirebaseClientConfigured());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!configured) return;
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (user) => {
      if (user) onAuthed(user);
    });
  }, [configured, onAuthed]);

  const signInGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      onAuthed(result.user);
      void trackGuestActivity("login");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not sign in with Google";
      setError(message.replace("Firebase:", "").trim());
    } finally {
      setBusy(false);
    }
  };

  if (!configured) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-6">
        <p className="font-display text-xl text-cream">Sign-in setup needed</p>
        <p className="mt-2 font-body text-sm leading-relaxed text-amber-100/90">
          Add Firebase Google Auth env vars on Vercel, enable Google in the
          Firebase console, then redeploy.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gold/25 bg-[#100e14] px-5 py-6">
      <p className="font-body text-[10px] uppercase tracking-[0.3em] text-gold/70">
        Sign in required
      </p>
      <h4 className="mt-2 font-display text-2xl text-cream">{title}</h4>
      <p className="mt-2 font-body text-sm leading-relaxed text-muted">
        {subtitle}
      </p>

      <div className="mt-5">
        <Button
          type="button"
          className="w-full"
          disabled={busy}
          onClick={signInGoogle}
        >
          {busy ? "Opening Google…" : ctaLabel}
        </Button>
      </div>

      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
    </div>
  );
}

export async function signOutGuest() {
  if (!isFirebaseClientConfigured()) return;
  await signOut(getFirebaseAuth());
}

export async function getGuestIdToken() {
  if (!isFirebaseClientConfigured()) return null;
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken();
}
