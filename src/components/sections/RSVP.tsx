"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { User } from "firebase/auth";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { wedding } from "@/data/wedding";
import {
  GuestAuthPanel,
  getGuestIdToken,
  signOutGuest,
} from "@/components/rsvp/GuestAuthPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useInvite } from "@/lib/invite-context";
import { cn } from "@/lib/utils";

const schema = z
  .object({
    name: z.string().min(2, "Please enter your full name"),
    guests: z
      .number({ error: "Enter number of guests" })
      .min(1, "At least 1 guest")
      .max(20, "Please contact the family for larger groups"),
    attendance: z.enum(["yes", "no", "maybe"], {
      message: "Please select your attendance",
    }),
    meal: z.enum(["vegetarian", "non-vegetarian", "no-preference"]),
    notes: z.string().max(500).optional(),
    contactFamily: z.string().optional(),
    needsAccommodation: z.enum(["yes", "no"]),
    stayPhone: z.string().optional(),
    stayPeople: z.number().optional(),
    stayRooms: z.number().optional(),
    stayCheckIn: z.string().optional(),
    stayCheckOut: z.string().optional(),
    stayNotes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.needsAccommodation !== "yes") return;
    if (!data.stayPhone || data.stayPhone.trim().length < 7) {
      ctx.addIssue({
        code: "custom",
        message: "Phone / WhatsApp is required for stay",
        path: ["stayPhone"],
      });
    }
    if (!data.stayPeople || data.stayPeople < 1) {
      ctx.addIssue({
        code: "custom",
        message: "How many people need a room?",
        path: ["stayPeople"],
      });
    }
    if (!data.stayRooms || data.stayRooms < 1) {
      ctx.addIssue({
        code: "custom",
        message: "How many rooms?",
        path: ["stayRooms"],
      });
    }
    if (!data.stayCheckIn) {
      ctx.addIssue({
        code: "custom",
        message: "Check-in date required",
        path: ["stayCheckIn"],
      });
    }
    if (!data.stayCheckOut) {
      ctx.addIssue({
        code: "custom",
        message: "Check-out date required",
        path: ["stayCheckOut"],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const fieldClass =
  "w-full rounded-xl border border-gold/25 bg-[#141018] px-4 py-3 font-body text-sm text-cream outline-none transition placeholder:text-muted/60 focus:border-gold/60 focus:bg-[#1a1520] [color-scheme:dark]";

const thankYouMessages = {
  yes: [
    {
      title: "Aww, you’re coming!",
      body: "Our hearts just did a little bhangra. Can’t wait to celebrate #Swaneet with you.",
    },
    {
      title: "Yay, seat saved!",
      body: "Thank you for saying yes. Maple Garden is going to sparkle brighter with you there.",
    },
    {
      title: "Blessings received!",
      body: "You’ve made Haneet & Swarandeep so happy. See you for the shaadi magic.",
    },
  ],
  maybe: [
    {
      title: "Fingers crossed!",
      body: "No pressure — just butterflies. We hope your “maybe” turns into a joyful yes.",
    },
    {
      title: "We’re holding a little hope",
      body: "Thank you for letting us know. We’ll keep a warm welcome ready, just in case.",
    },
  ],
  no: [
    {
      title: "We’ll miss you",
      body: "Thank you for telling us with love. Your blessings mean the world to #Swaneet.",
    },
    {
      title: "Sending hugs anyway",
      body: "We understand, and we’re grateful. Please keep us in your prayers on our big day.",
    },
  ],
} as const;

type ThankYouMessage = { title: string; body: string };

function pickMessage(attendance: FormValues["attendance"]): ThankYouMessage {
  const list = thankYouMessages[attendance];
  return list[Math.floor(Math.random() * list.length)];
}

export function RSVP() {
  const invite = useInvite();
  const [user, setUser] = useState<User | null>(null);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<ThankYouMessage | null>(null);
  const [staySubmitted, setStaySubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [hasExisting, setHasExisting] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [wasUpdate, setWasUpdate] = useState(false);

  const onAuthed = useCallback((next: User) => {
    setUser(next);
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      attendance: "yes",
      meal: "no-preference",
      guests: 1,
      needsAccommodation: "no",
      stayPeople: 1,
      stayRooms: 1,
      stayCheckIn: "2026-08-12",
      stayCheckOut: "2026-08-13",
    },
  });

  // Prefill from Google + load prior RSVP/stay when signing in again
  useEffect(() => {
    if (!user) {
      setHasExisting(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingExisting(true);
      try {
        const token = await getGuestIdToken();
        if (!token || cancelled) return;

        const res = await fetch("/api/rsvp/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) {
          if (user.displayName) setValue("name", user.displayName);
          return;
        }

        const data = (await res.json()) as {
          rsvp?: {
            name?: string;
            guests?: number;
            attendance?: "yes" | "no" | "maybe";
            meal?: "vegetarian" | "non-vegetarian" | "no-preference";
            notes?: string;
            contactFamily?: string;
            needsAccommodation?: boolean;
          } | null;
          accommodation?: {
            phone?: string;
            people?: number;
            rooms?: number;
            checkIn?: string;
            checkOut?: string;
            notes?: string;
          } | null;
        };

        if (cancelled) return;

        if (data.rsvp) {
          setHasExisting(true);
          reset({
            name: data.rsvp.name || user.displayName || "",
            guests: data.rsvp.guests || 1,
            attendance: data.rsvp.attendance || "yes",
            meal: data.rsvp.meal || "no-preference",
            notes: data.rsvp.notes || "",
            contactFamily: data.rsvp.contactFamily || "",
            needsAccommodation:
              data.rsvp.needsAccommodation || data.accommodation
                ? "yes"
                : "no",
            stayPhone: data.accommodation?.phone || "",
            stayPeople: data.accommodation?.people || data.rsvp.guests || 1,
            stayRooms: data.accommodation?.rooms || 1,
            stayCheckIn: data.accommodation?.checkIn || "2026-08-12",
            stayCheckOut: data.accommodation?.checkOut || "2026-08-13",
            stayNotes: data.accommodation?.notes || "",
          });
        } else if (user.displayName) {
          setHasExisting(Boolean(data.accommodation));
          setValue("name", user.displayName);
          if (data.accommodation) {
            setValue("needsAccommodation", "yes");
            setValue("stayPhone", data.accommodation.phone || "");
            setValue("stayPeople", data.accommodation.people || 1);
            setValue("stayRooms", data.accommodation.rooms || 1);
            setValue("stayCheckIn", data.accommodation.checkIn || "2026-08-12");
            setValue(
              "stayCheckOut",
              data.accommodation.checkOut || "2026-08-13",
            );
            setValue("stayNotes", data.accommodation.notes || "");
          }
        }
      } catch {
        if (!cancelled && user.displayName) {
          setValue("name", user.displayName);
        }
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, reset, setValue]);

  const needsAccommodation = watch("needsAccommodation");
  const guests = watch("guests");

  const familyList = useMemo(
    () =>
      (invite?.invite.rsvpFamilies || wedding.rsvpFamilies)
        .map((f) => f.name)
        .join(", "),
    [invite],
  );
  const familyOptions = invite?.invite.rsvpFamilies || wedding.rsvpFamilies;

  const onSubmit = async (data: FormValues) => {
    setSubmitError("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setSubmitError("Please sign in with Google again");
        setUser(null);
        return;
      }

      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: data.name,
          guests: data.guests,
          attendance: data.attendance,
          meal: data.meal,
          notes: data.notes,
          contactFamily: data.contactFamily,
          needsAccommodation: data.needsAccommodation === "yes",
          inviteSide: invite ? "bride" : undefined,
          inviteTier: invite?.tier,
          inviteSlug: invite?.slug,
          stay:
            data.needsAccommodation === "yes"
              ? {
                  phone: data.stayPhone,
                  people: data.stayPeople,
                  rooms: data.stayRooms,
                  checkIn: data.stayCheckIn,
                  checkOut: data.stayCheckOut,
                  notes: data.stayNotes,
                }
              : undefined,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        accommodation?: unknown;
        updated?: boolean;
      };
      if (!res.ok) {
        setSubmitError(payload.error || "Could not send your RSVP. Please try again.");
        if (res.status === 401) {
          await signOutGuest();
          setUser(null);
        }
        return;
      }
      setWasUpdate(Boolean(payload.updated));
      setMessage(pickMessage(data.attendance));
      setStaySubmitted(Boolean(payload.accommodation) && data.needsAccommodation === "yes");
      setHasExisting(true);
      setSuccess(true);
    } catch {
      setSubmitError("Could not send your RSVP. Please try again.");
    }
  };

  return (
    <section id="rsvp" className="section-pad relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(107,29,42,0.18),transparent_55%)]" />
      <div className="relative mx-auto max-w-2xl">
        <SectionHeading
          eyebrow="Kindly reply"
          title="RSVP"
          subtitle={`Sign in with Google, then RSVP. Please reply via ${familyList}.`}
        />

        <GlassCard glow>
          <AnimatePresence mode="wait">
            {success && message ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 220, damping: 16 }}
                  className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-gold"
                >
                  <Heart size={28} fill="currentColor" />
                </motion.div>
                <p className="font-body text-[10px] uppercase tracking-[0.35em] text-gold/70">
                  {wedding.hashtag}
                </p>
                <h3 className="mt-3 font-script text-4xl text-gold-soft sm:text-5xl">
                  {message.title}
                </h3>
                <p className="mt-4 max-w-sm font-body text-sm leading-relaxed text-muted">
                  {message.body}
                </p>
                {staySubmitted ? (
                  <p className="mt-4 max-w-sm font-body text-sm text-gold-soft">
                    Your stay request was {wasUpdate ? "updated" : "received"} —
                    the family will confirm by email.
                  </p>
                ) : null}
                <p className="mt-4 max-w-sm font-body text-xs text-muted">
                  Need to change something? Sign in with the same Google account
                  anytime to update your RSVP or stay.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-8"
                  onClick={() => {
                    setSuccess(false);
                    setMessage(null);
                    setStaySubmitted(false);
                  }}
                >
                  {hasExisting ? "Edit your reply" : "Submit another"}
                </Button>
              </motion.div>
            ) : !user ? (
              <motion.div
                key="auth"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <GuestAuthPanel
                  onAuthed={onAuthed}
                  title="RSVP with Google"
                  subtitle="Sign in with Gmail to RSVP. Come back anytime with the same account to update your reply or stay request."
                  ctaLabel="Continue with Google"
                />
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5"
                noValidate
              >
                <div className="rounded-xl border border-gold/20 bg-[#100e14] px-4 py-3">
                  <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                    Signed in
                  </p>
                  <p className="mt-1 font-body text-sm text-cream">
                    {user.email}
                  </p>
                  {loadingExisting ? (
                    <p className="mt-2 font-body text-xs text-muted">
                      Loading your saved RSVP…
                    </p>
                  ) : hasExisting ? (
                    <p className="mt-2 font-body text-xs text-gold-soft">
                      We found your earlier reply — edit below and save to
                      update.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="mt-2 font-body text-xs text-gold-soft"
                    onClick={async () => {
                      await signOutGuest();
                      setUser(null);
                      setHasExisting(false);
                    }}
                  >
                    Sign out
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="name"
                    className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted"
                  >
                    Full name
                  </label>
                  <input
                    id="name"
                    className={fieldClass}
                    placeholder="Your name"
                    {...register("name")}
                  />
                  {errors.name ? (
                    <p className="mt-1.5 text-xs text-red-300">
                      {errors.name.message}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="guests"
                      className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted"
                    >
                      Number of guests
                    </label>
                    <input
                      id="guests"
                      type="number"
                      min={1}
                      max={20}
                      className={fieldClass}
                      {...register("guests", {
                        valueAsNumber: true,
                        onChange: (e) => {
                          const value = Number(e.target.value);
                          if (
                            needsAccommodation === "yes" &&
                            Number.isFinite(value) &&
                            value > 0
                          ) {
                            setValue("stayPeople", value);
                          }
                        },
                      })}
                    />
                    {errors.guests ? (
                      <p className="mt-1.5 text-xs text-red-300">
                        {errors.guests.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="attendance"
                      className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted"
                    >
                      Attendance
                    </label>
                    <select
                      id="attendance"
                      className={cn(fieldClass, "appearance-none")}
                      {...register("attendance")}
                    >
                      <option value="yes">Joyfully attending</option>
                      <option value="maybe">Hopefully attending</option>
                      <option value="no">Unable to attend</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="meal"
                    className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted"
                  >
                    Meal preference
                  </label>
                  <select
                    id="meal"
                    className={cn(fieldClass, "appearance-none")}
                    {...register("meal")}
                  >
                    <option value="no-preference">No preference</option>
                    <option value="vegetarian">Vegetarian</option>
                    <option value="non-vegetarian">Non-vegetarian</option>
                  </select>
                </div>

                <div className="rounded-2xl border border-gold/25 bg-[#100e14] p-4">
                  <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
                    Accommodation
                  </p>
                  <p className="mt-2 font-display text-xl text-cream">
                    Do you need a stay arranged?
                  </p>
                  <p className="mt-1 font-body text-xs text-muted">
                    Choose clearly here — don’t write stay details in Notes.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <label
                      className={cn(
                        "cursor-pointer rounded-xl border px-4 py-3 font-body text-sm transition",
                        needsAccommodation === "no"
                          ? "border-gold bg-gold/15 text-cream"
                          : "border-gold/20 text-muted hover:border-gold/40",
                      )}
                    >
                      <input
                        type="radio"
                        value="no"
                        className="sr-only"
                        {...register("needsAccommodation")}
                      />
                      No — we have our own stay
                    </label>
                    <label
                      className={cn(
                        "cursor-pointer rounded-xl border px-4 py-3 font-body text-sm transition",
                        needsAccommodation === "yes"
                          ? "border-gold bg-gold/15 text-cream"
                          : "border-gold/20 text-muted hover:border-gold/40",
                      )}
                    >
                      <input
                        type="radio"
                        value="yes"
                        className="sr-only"
                        {...register("needsAccommodation", {
                          onChange: () => {
                            if (!watch("stayPeople")) {
                              setValue("stayPeople", guests || 1);
                            }
                          },
                        })}
                      />
                      Yes — please help with rooms
                    </label>
                  </div>

                  {needsAccommodation === "yes" ? (
                    <div className="mt-5 space-y-4 border-t border-gold/15 pt-5">
                      <p className="font-body text-xs text-gold-soft">
                        Tell us who needs rooms and for which nights.
                      </p>
                      <div>
                        <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                          Phone / WhatsApp
                        </label>
                        <input
                          className={fieldClass}
                          placeholder="+91 …"
                          {...register("stayPhone")}
                        />
                        {errors.stayPhone ? (
                          <p className="mt-1.5 text-xs text-red-300">
                            {errors.stayPhone.message}
                          </p>
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
                            {...register("stayPeople", { valueAsNumber: true })}
                          />
                          {errors.stayPeople ? (
                            <p className="mt-1.5 text-xs text-red-300">
                              {errors.stayPeople.message}
                            </p>
                          ) : null}
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
                            {...register("stayRooms", { valueAsNumber: true })}
                          />
                          {errors.stayRooms ? (
                            <p className="mt-1.5 text-xs text-red-300">
                              {errors.stayRooms.message}
                            </p>
                          ) : null}
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
                            {...register("stayCheckIn")}
                          />
                          {errors.stayCheckIn ? (
                            <p className="mt-1.5 text-xs text-red-300">
                              {errors.stayCheckIn.message}
                            </p>
                          ) : null}
                        </div>
                        <div>
                          <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                            Check-out
                          </label>
                          <input
                            type="date"
                            className={fieldClass}
                            {...register("stayCheckOut")}
                          />
                          {errors.stayCheckOut ? (
                            <p className="mt-1.5 text-xs text-red-300">
                              {errors.stayCheckOut.message}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                          Stay notes (optional)
                        </label>
                        <textarea
                          rows={2}
                          className={cn(fieldClass, "resize-none")}
                          placeholder="Kids, arrival time, accessibility…"
                          {...register("stayNotes")}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="contactFamily"
                    className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted"
                  >
                    RSVP via
                  </label>
                  <select
                    id="contactFamily"
                    className={cn(fieldClass, "appearance-none")}
                    {...register("contactFamily")}
                  >
                    <option value="">Select a family</option>
                    {familyOptions.map((f) => (
                      <option key={f.name} value={f.name}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="notes"
                    className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted"
                  >
                    Message for the couple (optional)
                  </label>
                  <textarea
                    id="notes"
                    rows={3}
                    className={cn(fieldClass, "resize-none")}
                    placeholder="Blessings or a short note — not meal or stay details"
                    {...register("notes")}
                  />
                </div>

                {submitError ? (
                  <p className="text-xs text-red-300">{submitError}</p>
                ) : null}

                <Button
                  type="submit"
                  disabled={isSubmitting || loadingExisting}
                  className="w-full"
                >
                  {isSubmitting
                    ? hasExisting
                      ? "Saving your update…"
                      : "Sending with love…"
                    : hasExisting
                      ? needsAccommodation === "yes"
                        ? "Update RSVP + stay"
                        : "Update RSVP"
                      : needsAccommodation === "yes"
                        ? "Send RSVP + stay request"
                        : "Send RSVP"}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>
    </section>
  );
}
