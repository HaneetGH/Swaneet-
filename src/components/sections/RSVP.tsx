"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { useGuestAuth } from "@/hooks/useGuestAuth";
import {
  deriveOverallAttendance,
  rsvpDaysForSite,
  type RsvpDayOption,
} from "@/lib/rsvp-days";
import { cn } from "@/lib/utils";
import type { RsvpDayResponse } from "@/lib/types";

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

function stableThankYou(
  attendance: FormValues["attendance"],
): ThankYouMessage {
  return thankYouMessages[attendance][0];
}

function attendanceLabel(attendance: FormValues["attendance"]) {
  if (attendance === "yes") return "Joyfully attending";
  if (attendance === "maybe") return "Hopefully attending";
  return "Unable to attend";
}

export function RSVP() {
  const invite = useInvite();
  const { enabled, ready, site } = useFeatureFlags();
  const { user, ready: authReady } = useGuestAuth();
  const rsvpOn = enabled("rsvp");
  const accommodationOn = enabled("accommodation");
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<ThankYouMessage | null>(null);
  const [staySubmitted, setStaySubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [hasExisting, setHasExisting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [wasUpdate, setWasUpdate] = useState(false);
  const [savedSummary, setSavedSummary] = useState<{
    attendance: FormValues["attendance"];
    guests: number;
    name: string;
  } | null>(null);
  const [dayAnswers, setDayAnswers] = useState<
    Record<string, "yes" | "no" | "maybe">
  >({});

  const siteDays = useMemo<RsvpDayOption[]>(
    () => rsvpDaysForSite(site, invite?.events),
    [site, invite?.events],
  );
  const multiDay = siteDays.length > 1;

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

  // Default day answers when the invite days change
  useEffect(() => {
    setDayAnswers((prev) => {
      const next: Record<string, "yes" | "no" | "maybe"> = {};
      for (const day of siteDays) {
        next[day.dateKey] = prev[day.dateKey] || "yes";
      }
      return next;
    });
  }, [siteDays]);

  // Prefill from Google + load prior RSVP/stay for THIS invite site only
  useEffect(() => {
    if (!user) {
      setHasExisting(false);
      setIsEditing(false);
      setSavedSummary(null);
      setSuccess(false);
      setMessage(null);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingExisting(true);
      try {
        const token = await getGuestIdToken();
        if (!token || cancelled) return;

        const res = await fetch(`/api/rsvp/me?site=${site}`, {
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
            dayResponses?: RsvpDayResponse[];
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
          const overall = data.rsvp.attendance || "yes";
          const guestCount = data.rsvp.guests || 1;
          const displayName = data.rsvp.name || user.displayName || "";
          setSavedSummary({
            attendance: overall,
            guests: guestCount,
            name: displayName,
          });
          let firstDiscovery = false;
          setHasExisting((prev) => {
            firstDiscovery = !prev;
            return true;
          });
          // Returning guests land on thanks — not the full form — until they choose Edit
          if (firstDiscovery) {
            setIsEditing(false);
            setMessage(stableThankYou(overall));
            setStaySubmitted(Boolean(data.accommodation));
          }
          const answers: Record<string, "yes" | "no" | "maybe"> = {};
          for (const day of siteDays) {
            const saved = data.rsvp.dayResponses?.find(
              (d) => d.dateKey === day.dateKey,
            );
            answers[day.dateKey] = saved?.attendance || overall;
          }
          setDayAnswers(answers);
          reset({
            name: displayName,
            guests: guestCount,
            attendance: overall,
            meal: data.rsvp.meal || "no-preference",
            notes: data.rsvp.notes || "",
            contactFamily: data.rsvp.contactFamily || "",
            needsAccommodation:
              data.rsvp.needsAccommodation || Boolean(data.accommodation)
                ? "yes"
                : "no",
            stayPhone: data.accommodation?.phone || "",
            stayPeople: data.accommodation?.people || data.rsvp.guests || 1,
            stayRooms: data.accommodation?.rooms || 1,
            stayCheckIn: data.accommodation?.checkIn || "2026-08-12",
            stayCheckOut: data.accommodation?.checkOut || "2026-08-13",
            stayNotes: data.accommodation?.notes || "",
          });
        } else {
          setHasExisting(false);
          setSavedSummary(null);
          setIsEditing(true);
          setMessage(null);
          if (user.displayName) setValue("name", user.displayName);
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
  }, [user, reset, setValue, site, siteDays]);

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

  const headingSubtitle = useMemo(() => {
    if (ready && !rsvpOn) {
      return "RSVP is temporarily closed for this invite.";
    }
    if (!authReady) {
      return `Please reply via ${familyList}.`;
    }
    if (!user) {
      return invite
        ? `Sign in with Google, then RSVP. Mehfil & Laavan share your reply for the same days — main wedding site stays separate. Please reply via ${familyList}.`
        : `Sign in with Google, then RSVP for this invite only. Please reply via ${familyList}.`;
    }
    if (hasExisting && !isEditing) {
      return "Thank you — your reply is saved. You can update it anytime.";
    }
    return invite
      ? `Mehfil & Laavan share your reply for the same days — main wedding site stays separate. Please reply via ${familyList}.`
      : `RSVP for this invite only. Please reply via ${familyList}.`;
  }, [
    ready,
    rsvpOn,
    authReady,
    user,
    invite,
    familyList,
    hasExisting,
    isEditing,
  ]);

  const showThanks =
    Boolean(message) &&
    ((success && !isEditing) || (hasExisting && !isEditing && !loadingExisting));

  const openEditor = () => {
    setSuccess(false);
    setIsEditing(true);
    setSubmitError("");
  };

  const handleSignOut = async () => {
    await signOutGuest();
    // useGuestAuth clears `user`; local RSVP state resets in the user effect
  };

  const onSubmit = async (data: FormValues) => {
    setSubmitError("");
    try {
      const token = await getGuestIdToken();
      if (!token) {
        setSubmitError("Please sign in with Google again");
        await signOutGuest();
        return;
      }

      const dayResponses: RsvpDayResponse[] = multiDay
        ? siteDays.map((day) => ({
            dateKey: day.dateKey,
            date: day.date,
            label: day.label,
            attendance: dayAnswers[day.dateKey] || "yes",
          }))
        : siteDays.map((day) => ({
            dateKey: day.dateKey,
            date: day.date,
            label: day.label,
            attendance: data.attendance,
          }));

      const overall = multiDay
        ? deriveOverallAttendance(dayResponses)
        : data.attendance;

      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: data.name,
          guests: data.guests,
          attendance: overall,
          meal: data.meal,
          notes: data.notes,
          contactFamily: data.contactFamily,
          needsAccommodation: data.needsAccommodation === "yes",
          inviteSite: site,
          inviteSide: invite ? "bride" : undefined,
          inviteTier: invite?.tier,
          inviteSlug: invite?.slug,
          dayResponses,
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
        }
        return;
      }
      setWasUpdate(Boolean(payload.updated));
      setMessage(pickMessage(overall));
      setStaySubmitted(Boolean(payload.accommodation) && data.needsAccommodation === "yes");
      setHasExisting(true);
      setIsEditing(false);
      setSavedSummary({
        attendance: overall,
        guests: data.guests,
        name: data.name,
      });
      setSuccess(true);
    } catch {
      setSubmitError("Could not send your RSVP. Please try again.");
    }
  };

  useEffect(() => {
    if (!accommodationOn) {
      setValue("needsAccommodation", "no");
    }
  }, [accommodationOn, setValue]);

  return (
    <section id="rsvp" className="section-pad relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(107,29,42,0.18),transparent_55%)]" />
      <div className="relative mx-auto max-w-2xl">
        <SectionHeading
          eyebrow="Kindly reply"
          title="RSVP"
          subtitle={headingSubtitle}
        />

        {ready && !rsvpOn ? (
          <GlassCard glow>
            <p className="py-8 text-center font-body text-sm text-muted">
              The host has turned off RSVP for this page. Please check back
              later or contact the family.
            </p>
          </GlassCard>
        ) : (
        <GlassCard glow>
          <AnimatePresence mode="wait">
            {showThanks && message ? (
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
                {savedSummary ? (
                  <p className="mt-4 max-w-sm font-body text-sm text-cream">
                    {savedSummary.name
                      ? `${savedSummary.name} · `
                      : ""}
                    {attendanceLabel(savedSummary.attendance)}
                    {` · ${savedSummary.guests} guest${
                      savedSummary.guests === 1 ? "" : "s"
                    }`}
                  </p>
                ) : null}
                {staySubmitted ? (
                  <p className="mt-4 max-w-sm font-body text-sm text-gold-soft">
                    Your stay request was{" "}
                    {success && wasUpdate
                      ? "updated"
                      : success
                        ? "received"
                        : "noted"}{" "}
                    — the family will confirm by email.
                  </p>
                ) : null}
                {user ? (
                  <div className="mt-5 rounded-xl border border-gold/20 bg-[#100e14] px-4 py-3">
                    <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                      Signed in
                    </p>
                    <p className="mt-1 font-body text-sm text-cream">
                      {user.email}
                    </p>
                    <button
                      type="button"
                      className="mt-2 font-body text-xs text-gold-soft"
                      onClick={() => void handleSignOut()}
                    >
                      Sign out
                    </button>
                  </div>
                ) : null}
                <p className="mt-4 max-w-sm font-body text-xs text-muted">
                  Need to change something? Update your RSVP or stay below.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-8"
                  onClick={openEditor}
                >
                  Edit your reply
                </Button>
              </motion.div>
            ) : !user ? (
              <motion.div
                key="auth"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {!authReady ? (
                  <p className="py-8 text-center font-body text-sm text-muted">
                    Checking your sign-in…
                  </p>
                ) : (
                  <GuestAuthPanel
                    onAuthed={() => undefined}
                    title="RSVP with Google"
                    subtitle="Sign in with Gmail to RSVP. Come back anytime with the same account to update your reply or stay request."
                    ctaLabel="Continue with Google"
                  />
                )}
              </motion.div>
            ) : loadingExisting ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-10 text-center"
              >
                <p className="font-body text-sm text-muted">
                  Loading your saved RSVP…
                </p>
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
                  {hasExisting ? (
                    <p className="mt-2 font-body text-xs text-gold-soft">
                      Editing your earlier reply — save to update.
                    </p>
                  ) : (
                    <p className="mt-2 font-body text-xs text-muted">
                      You’re signed in — fill in your RSVP below.
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-2 font-body text-xs text-gold-soft"
                    onClick={() => void handleSignOut()}
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

                  {!multiDay ? (
                    <div>
                      <label
                        htmlFor="attendance"
                        className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted"
                      >
                        Attendance
                        {siteDays[0] ? (
                          <span className="normal-case tracking-normal text-muted/80">
                            {" "}
                            · {siteDays[0].date}
                          </span>
                        ) : null}
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
                  ) : null}
                </div>

                {multiDay ? (
                  <div className="space-y-3 rounded-2xl border border-gold/25 bg-[#100e14] p-4">
                    <div>
                      <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
                        Days
                      </p>
                      <p className="mt-1 font-body text-sm text-cream">
                        One reply per celebration day on this invite
                      </p>
                    </div>
                    {siteDays.map((day) => (
                      <div
                        key={day.dateKey}
                        className="grid gap-2 border-t border-gold/10 pt-3 first:border-t-0 first:pt-0 sm:grid-cols-[1fr_auto] sm:items-center"
                      >
                        <div>
                          <p className="font-body text-sm text-cream">
                            {day.date}
                            {day.label ? (
                              <span className="text-muted"> · {day.label}</span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 font-body text-xs text-muted">
                            {day.eventNames.join(" · ")}
                          </p>
                        </div>
                        <select
                          className={cn(
                            fieldClass,
                            "appearance-none sm:min-w-[12rem]",
                          )}
                          value={dayAnswers[day.dateKey] || "yes"}
                          onChange={(e) => {
                            const value = e.target.value as
                              | "yes"
                              | "no"
                              | "maybe";
                            const next = {
                              ...dayAnswers,
                              [day.dateKey]: value,
                            };
                            setDayAnswers(next);
                            setValue(
                              "attendance",
                              deriveOverallAttendance(
                                siteDays.map((d) => ({
                                  attendance: next[d.dateKey] || "yes",
                                })),
                              ),
                            );
                          }}
                          aria-label={`Attendance for ${day.date}`}
                        >
                          <option value="yes">Joyfully attending</option>
                          <option value="maybe">Hopefully attending</option>
                          <option value="no">Unable to attend</option>
                        </select>
                      </div>
                    ))}
                  </div>
                ) : null}

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

                {accommodationOn ? (
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
                ) : null}

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
        )}
      </div>
    </section>
  );
}
