"use client";

import type { User } from "firebase/auth";
import { useCallback, useEffect, useState } from "react";
import { wedding } from "@/data/wedding";
import {
  GuestAuthPanel,
  getGuestIdToken,
  signOutGuest,
} from "@/components/rsvp/GuestAuthPanel";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-xl border border-gold/25 bg-[#141018] px-4 py-3 font-body text-sm text-cream outline-none transition placeholder:text-muted/60 focus:border-gold/60 focus:bg-[#1a1520] [color-scheme:dark]";

type AccommodationRequestPanelProps = {
  defaultName?: string;
  defaultPeople?: number;
  defaultFamily?: string;
  rsvpId?: string;
  onDone?: () => void;
};

export function AccommodationRequestPanel({
  defaultName = "",
  defaultPeople = 1,
  defaultFamily = "",
  rsvpId,
  onDone,
}: AccommodationRequestPanelProps) {
  const [user, setUser] = useState<User | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailFromAuth, setEmailFromAuth] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [people, setPeople] = useState(defaultPeople);
  const [rooms, setRooms] = useState(1);
  const [checkIn, setCheckIn] = useState("2026-08-12");
  const [checkOut, setCheckOut] = useState("2026-08-13");
  const [contactFamily, setContactFamily] = useState(defaultFamily);
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [wasUpdate, setWasUpdate] = useState(false);

  const resetEmailGate = () => {
    setEmailVerified(false);
    setEmailFromAuth(false);
    setEmailCode("");
    setCodeSent(false);
    setEmailError("");
  };

  const onAuthed = useCallback(
    (next: User) => {
      setUser(next);
      if (!defaultName && next.displayName) setName(next.displayName);
      if (next.phoneNumber) setPhone(next.phoneNumber);
      if (next.email) {
        setEmail(next.email);
        setEmailVerified(true);
        setEmailFromAuth(true);
      } else {
        resetEmailGate();
      }
    },
    [defaultName],
  );

  useEffect(() => {
    if (!user) {
      setHasExisting(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getGuestIdToken();
        if (!token || cancelled) return;
        const res = await fetch("/api/rsvp/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          accommodation?: {
            name?: string;
            phone?: string;
            email?: string;
            people?: number;
            rooms?: number;
            checkIn?: string;
            checkOut?: string;
            notes?: string;
            contactFamily?: string;
          } | null;
        };
        if (cancelled || !data.accommodation) return;
        setHasExisting(true);
        const stay = data.accommodation;
        if (stay.name) setName(stay.name);
        if (stay.phone) setPhone(stay.phone);
        if (stay.email) setEmail(stay.email);
        if (stay.people) setPeople(stay.people);
        if (stay.rooms) setRooms(stay.rooms);
        if (stay.checkIn) setCheckIn(stay.checkIn);
        if (stay.checkOut) setCheckOut(stay.checkOut);
        if (stay.notes) setNotes(stay.notes);
        if (stay.contactFamily) setContactFamily(stay.contactFamily);
      } catch {
        // ignore — blank form is fine
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const sendEmailCode = async () => {
    setEmailBusy(true);
    setEmailError("");
    try {
      const res = await fetch("/api/auth/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setEmailError(data.error || "Could not send verification code");
        return;
      }
      setCodeSent(true);
    } catch {
      setEmailError("Could not send verification code");
    } finally {
      setEmailBusy(false);
    }
  };

  const verifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailBusy(true);
    setEmailError("");
    try {
      const res = await fetch("/api/auth/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, code: emailCode }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        email?: string;
      };
      if (!res.ok) {
        setEmailError(data.error || "Could not verify email");
        return;
      }
      if (data.email) setEmail(data.email);
      setEmailVerified(true);
      setEmailFromAuth(false);
    } catch {
      setEmailError("Could not verify email");
    } finally {
      setEmailBusy(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailVerified) {
      setSubmitError("Please verify your email first");
      return;
    }
    setSubmitting(true);
    setSubmitError("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setSubmitError("Please sign in again to continue");
        setUser(null);
        return;
      }

      const res = await fetch("/api/accommodation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          phone,
          email,
          people,
          rooms,
          checkIn,
          checkOut,
          notes: notes || undefined,
          contactFamily: contactFamily || undefined,
          rsvpId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        updated?: boolean;
      };
      if (!res.ok) {
        setSubmitError(data.error || "Could not send accommodation request");
        if (res.status === 401) {
          await signOutGuest();
          setUser(null);
        }
        return;
      }
      setWasUpdate(Boolean(data.updated));
      setHasExisting(true);
      setSuccess(true);
    } catch {
      setSubmitError("Could not send accommodation request");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="rounded-2xl border border-gold/25 bg-gold/10 px-5 py-6 text-center">
        <p className="font-display text-2xl text-cream">
          {wasUpdate ? "Stay request updated" : "Stay request received"}
        </p>
        <p className="mt-2 font-body text-sm text-muted">
          The family will confirm accommodation details by email soon. Sign in
          again anytime to change your request.
        </p>
        {onDone ? (
          <Button type="button" variant="outline" className="mt-5" onClick={onDone}>
            Done
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="mt-5"
            onClick={() => setSuccess(false)}
          >
            Edit stay request
          </Button>
        )}
      </div>
    );
  }

  if (!user) {
    return (
      <GuestAuthPanel
        onAuthed={onAuthed}
        subtitle="Sign in with Google to share stay details. Use the same account later to update your request."
      />
    );
  }

  if (!emailVerified) {
    return (
      <div className="space-y-4 rounded-2xl border border-gold/25 bg-[#100e14] px-5 py-6">
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.3em] text-gold/70">
            Signed in
          </p>
          <h4 className="mt-2 font-display text-2xl text-cream">
            Add & verify email
          </h4>
          <p className="mt-1 font-body text-sm text-muted">
            We don’t have an email for you yet. Confirm one so stay details can
            be sent to you.
          </p>
        </div>

        <form onSubmit={verifyEmailCode} className="space-y-3">
          <div>
            <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Email
            </label>
            <input
              type="email"
              className={fieldClass}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setCodeSent(false);
                setEmailCode("");
              }}
              placeholder="you@example.com"
              required
            />
          </div>

          {!codeSent ? (
            <Button
              type="button"
              className="w-full"
              disabled={emailBusy || !email.trim()}
              onClick={sendEmailCode}
            >
              {emailBusy ? "Sending…" : "Send verification code"}
            </Button>
          ) : (
            <>
              <div>
                <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                  Verification code
                </label>
                <input
                  className={fieldClass}
                  value={emailCode}
                  onChange={(e) => setEmailCode(e.target.value)}
                  placeholder="6-digit code from email"
                  inputMode="numeric"
                  required
                />
              </div>
              <Button type="submit" disabled={emailBusy} className="w-full">
                {emailBusy ? "Verifying…" : "Verify email & continue"}
              </Button>
              <button
                type="button"
                className="w-full font-body text-xs text-gold-soft"
                disabled={emailBusy}
                onClick={sendEmailCode}
              >
                Resend code
              </button>
            </>
          )}
        </form>

        {emailError ? <p className="text-xs text-red-300">{emailError}</p> : null}

        <button
          type="button"
          className="w-full font-body text-xs text-muted hover:text-cream"
          onClick={async () => {
            await signOutGuest();
            setUser(null);
            resetEmailGate();
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-gold/25 bg-[#100e14] px-5 py-6"
    >
      <div>
        <p className="font-body text-[10px] uppercase tracking-[0.3em] text-gold/70">
          Signed in
        </p>
        <h4 className="mt-2 font-display text-2xl text-cream">
          Accommodation details
        </h4>
        <p className="mt-1 font-body text-sm text-muted">
          {email} · tell us how many people need a stay.
        </p>
        {hasExisting ? (
          <p className="mt-2 font-body text-xs text-gold-soft">
            We found your earlier stay request — edit and save to update.
          </p>
        ) : null}
      </div>

      <div>
        <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
          Full name
        </label>
        <input
          className={fieldClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
          Phone / WhatsApp
        </label>
        <input
          className={fieldClass}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+91 …"
          required
        />
      </div>

      <div>
        <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
          Email (verified)
        </label>
        <input
          type="email"
          className={cn(fieldClass, emailFromAuth && "opacity-80")}
          value={email}
          readOnly
          required
        />
        {!emailFromAuth ? (
          <button
            type="button"
            className="mt-2 font-body text-xs text-gold-soft"
            onClick={() => {
              setEmailVerified(false);
              setCodeSent(false);
              setEmailCode("");
            }}
          >
            Use a different email
          </button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            People needing stay
          </label>
          <input
            type="number"
            min={1}
            max={30}
            className={fieldClass}
            value={people}
            onChange={(e) => setPeople(Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Rooms needed
          </label>
          <input
            type="number"
            min={1}
            max={15}
            className={fieldClass}
            value={rooms}
            onChange={(e) => setRooms(Number(e.target.value))}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Check-in
          </label>
          <input
            type="date"
            className={fieldClass}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
            Check-out
          </label>
          <input
            type="date"
            className={fieldClass}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
          Contact family
        </label>
        <select
          className={cn(fieldClass, "appearance-none")}
          value={contactFamily}
          onChange={(e) => setContactFamily(e.target.value)}
        >
          <option value="">Select a family</option>
          {wedding.rsvpFamilies.map((f) => (
            <option key={f.name} value={f.name}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
          Notes
        </label>
        <textarea
          rows={3}
          className={cn(fieldClass, "resize-none")}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Arrival time, kids, accessibility, etc."
        />
      </div>

      {submitError ? (
        <p className="text-xs text-red-300">{submitError}</p>
      ) : null}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting
          ? hasExisting
            ? "Saving…"
            : "Sending…"
          : hasExisting
            ? "Update stay request"
            : "Submit stay request"}
      </Button>

      <button
        type="button"
        className="w-full font-body text-xs text-muted hover:text-cream"
        onClick={async () => {
          await signOutGuest();
          setUser(null);
          resetEmailGate();
        }}
      >
        Sign out
      </button>
    </form>
  );
}
