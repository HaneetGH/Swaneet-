"use client";

import {
  ConfirmationResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useRef, useState } from "react";
import {
  getFirebaseAuth,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-xl border border-gold/25 bg-[#141018] px-4 py-3 font-body text-sm text-cream outline-none transition placeholder:text-muted/60 focus:border-gold/60 focus:bg-[#1a1520] [color-scheme:dark]";

type GuestAuthPanelProps = {
  onAuthed: (user: User) => void;
};

function toE164(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

export function GuestAuthPanel({ onAuthed }: GuestAuthPanelProps) {
  const [configured] = useState(() => isFirebaseClientConfigured());
  const [mode, setMode] = useState<"choose" | "phone">("choose");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(
    null,
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    if (!configured) return;
    const auth = getFirebaseAuth();
    return onAuthStateChanged(auth, (user) => {
      if (user) onAuthed(user);
    });
  }, [configured, onAuthed]);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const ensureRecaptcha = async () => {
    const auth = getFirebaseAuth();
    if (recaptchaRef.current) return recaptchaRef.current;
    const verifier = new RecaptchaVerifier(auth, "stay-recaptcha", {
      size: "invisible",
    });
    recaptchaRef.current = verifier;
    return verifier;
  };

  const signInGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      onAuthed(result.user);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Google sign-in failed";
      setError(message.replace("Firebase:", "").trim());
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const e164 = toE164(phone);
      if (e164.length < 10) {
        setError("Enter a valid phone number with country code");
        return;
      }
      const auth = getFirebaseAuth();
      const verifier = await ensureRecaptcha();
      const result = await signInWithPhoneNumber(auth, e164, verifier);
      setConfirmation(result);
    } catch (err) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      const message =
        err instanceof Error ? err.message : "Could not send OTP";
      setError(message.replace("Firebase:", "").trim());
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmation) return;
    setBusy(true);
    setError("");
    try {
      const result = await confirmation.confirm(otp.trim());
      onAuthed(result.user);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Invalid OTP";
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
          Add Firebase Google + Phone Auth env vars on Vercel, enable those
          providers in the Firebase console, then redeploy.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gold/25 bg-[#100e14] px-5 py-6">
      <p className="font-body text-[10px] uppercase tracking-[0.3em] text-gold/70">
        Sign in required
      </p>
      <h4 className="mt-2 font-display text-2xl text-cream">
        Request accommodation
      </h4>
      <p className="mt-2 font-body text-sm leading-relaxed text-muted">
        Sign in with Google or phone OTP. If we don’t have your email yet,
        you’ll verify it next so stay confirmations can reach you.
      </p>

      {mode === "choose" ? (
        <div className="mt-5 space-y-3">
          <Button
            type="button"
            className="w-full"
            disabled={busy}
            onClick={signInGoogle}
          >
            {busy ? "Opening Google…" : "Continue with Google"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => setMode("phone")}
          >
            Continue with phone OTP
          </Button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {!confirmation ? (
            <form onSubmit={sendOtp} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                  Phone number
                </span>
                <input
                  className={fieldClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  required
                />
              </label>
              <p className="font-body text-[11px] text-muted">
                Indian numbers can be entered as 10 digits — +91 is added
                automatically.
              </p>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Sending OTP…" : "Send OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                  Enter OTP
                </span>
                <input
                  className={fieldClass}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="6-digit code"
                  inputMode="numeric"
                  required
                />
              </label>
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? "Verifying…" : "Verify & continue"}
              </Button>
              <button
                type="button"
                className="w-full font-body text-xs text-gold-soft"
                onClick={() => {
                  setConfirmation(null);
                  setOtp("");
                }}
              >
                Use a different number
              </button>
            </form>
          )}

          <button
            type="button"
            className={cn("w-full font-body text-xs text-muted hover:text-cream")}
            onClick={() => {
              setMode("choose");
              setConfirmation(null);
              setOtp("");
              setError("");
            }}
          >
            Back to sign-in options
          </button>
        </div>
      )}

      {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}
      <div id="stay-recaptcha" />
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
