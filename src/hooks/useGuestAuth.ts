"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import {
  getFirebaseAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import { trackGuestActivity } from "@/lib/guest-activity";
import { useInvite } from "@/lib/invite-context";
import { signOutGuest } from "@/components/rsvp/GuestAuthPanel";

export function useGuestAuth() {
  const invite = useInvite();
  const configured = isFirebaseClientConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!configured);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!configured) {
      setReady(true);
      return;
    }
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (next) => {
      setUser(next);
      setReady(true);
    });
  }, [configured]);

  const signIn = useCallback(async () => {
    if (!configured) {
      setError("Sign-in is not configured yet.");
      return null;
    }
    setBusy(true);
    setError("");
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      setUser(result.user);
      void trackGuestActivity(
        "login",
        invite?.slug ? `invite:${invite.slug}` : undefined,
      );
      return result.user;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not sign in with Google";
      setError(message.replace("Firebase:", "").trim());
      return null;
    } finally {
      setBusy(false);
    }
  }, [configured, invite?.slug]);

  const signOut = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      await signOutGuest();
      setUser(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not sign out";
      setError(message);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    configured,
    ready,
    user,
    busy,
    error,
    signIn,
    signOut,
  };
}
