"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { wedding } from "@/data/wedding";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Please enter your full name"),
  guests: z
    .number({ error: "Enter number of guests" })
    .min(1, "At least 1 guest")
    .max(20, "Please contact the family for larger groups"),
  attendance: z.enum(["yes", "no", "maybe"], {
    message: "Please select your attendance",
  }),
  meal: z.enum(["vegetarian", "non-vegetarian", "no-preference"]).optional(),
  notes: z.string().max(500).optional(),
  contactFamily: z.string().optional(),
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
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState<ThankYouMessage | null>(null);
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      attendance: "yes",
      meal: "no-preference",
      guests: 1,
    },
  });

  const familyList = useMemo(
    () => wedding.rsvpFamilies.map((f) => f.name).join(", "),
    [],
  );

  const onSubmit = async (data: FormValues) => {
    setSubmitError("");
    try {
      const res = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        setSubmitError("Could not send your RSVP. Please try again.");
        return;
      }
      setMessage(pickMessage(data.attendance));
      setSuccess(true);
      reset();
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
          subtitle={`Please RSVP with the ${familyList}`}
        />

        <GlassCard glow>
          <AnimatePresence mode="wait">
            {success && message ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center py-10 text-center"
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
                <Button
                  type="button"
                  variant="outline"
                  className="mt-8"
                  onClick={() => {
                    setSuccess(false);
                    setMessage(null);
                  }}
                >
                  Submit another
                </Button>
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
                <div>
                  <label htmlFor="name" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted">
                    Full name
                  </label>
                  <input
                    id="name"
                    className={fieldClass}
                    placeholder="Your name"
                    {...register("name")}
                  />
                  {errors.name ? (
                    <p className="mt-1.5 text-xs text-red-300">{errors.name.message}</p>
                  ) : null}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="guests" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted">
                      Number of guests
                    </label>
                    <input
                      id="guests"
                      type="number"
                      min={1}
                      max={20}
                      className={fieldClass}
                      {...register("guests", { valueAsNumber: true })}
                    />
                    {errors.guests ? (
                      <p className="mt-1.5 text-xs text-red-300">
                        {errors.guests.message}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor="attendance" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted">
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
                  <label htmlFor="meal" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted">
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

                <div>
                  <label htmlFor="contactFamily" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted">
                    RSVP via
                  </label>
                  <select
                    id="contactFamily"
                    className={cn(fieldClass, "appearance-none")}
                    {...register("contactFamily")}
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
                  <label htmlFor="notes" className="mb-2 block font-body text-xs uppercase tracking-[0.2em] text-muted">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={4}
                    className={cn(fieldClass, "resize-none")}
                    placeholder="Any message for the couple or families"
                    {...register("notes")}
                  />
                </div>

                {submitError ? (
                  <p className="text-xs text-red-300">{submitError}</p>
                ) : null}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? "Sending with love…" : "Send RSVP"}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </GlassCard>
      </div>
    </section>
  );
}
