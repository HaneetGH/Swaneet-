"use client";

import type { User } from "firebase/auth";
import { useCallback, useState } from "react";
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

  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState("");
  const [people, setPeople] = useState(defaultPeople);
  const [rooms, setRooms] = useState(1);
  const [checkIn, setCheckIn] = useState("2026-08-12");
  const [checkOut, setCheckOut] = useState("2026-08-13");
  const [contactFamily, setContactFamily] = useState(defaultFamily);
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const onAuthed = useCallback((next: User) => {
    setUser(next);
    if (!defaultName && next.displayName) setName(next.displayName);
    if (next.phoneNumber) setPhone(next.phoneNumber);
  }, [defaultName]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
        body: JSON.stringify({
          name,
          phone,
          people,
          rooms,
          checkIn,
          checkOut,
          notes: notes || undefined,
          contactFamily: contactFamily || undefined,
          rsvpId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setSubmitError(data.error || "Could not send accommodation request");
        if (res.status === 401) {
          await signOutGuest();
          setUser(null);
        }
        return;
      }
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
        <p className="font-display text-2xl text-cream">Stay request received</p>
        <p className="mt-2 font-body text-sm text-muted">
          The family will confirm accommodation details with you soon.
        </p>
        {onDone ? (
          <Button type="button" variant="outline" className="mt-5" onClick={onDone}>
            Done
          </Button>
        ) : null}
      </div>
    );
  }

  if (!user) {
    return <GuestAuthPanel onAuthed={onAuthed} />;
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
          {user.email || user.phoneNumber || "Verified guest"} · tell us how many
          people need a stay.
        </p>
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
        {submitting ? "Sending…" : "Submit stay request"}
      </Button>

      <button
        type="button"
        className="w-full font-body text-xs text-muted hover:text-cream"
        onClick={async () => {
          await signOutGuest();
          setUser(null);
        }}
      >
        Sign out
      </button>
    </form>
  );
}
