"use client";

import { Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { RsvpEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

type RsvpManagerProps = {
  initialRsvps: RsvpEntry[];
};

const attendanceLabel = {
  yes: "Attending",
  maybe: "Maybe",
  no: "Not attending",
} as const;

const attendanceStyle = {
  yes: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  maybe: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  no: "border-rose-400/30 bg-rose-400/10 text-rose-200",
} as const;

export function RsvpManager({ initialRsvps }: RsvpManagerProps) {
  const [rsvps, setRsvps] = useState(initialRsvps);
  const [filter, setFilter] = useState<"all" | "yes" | "maybe" | "no">("all");

  const filtered = useMemo(
    () =>
      filter === "all"
        ? rsvps
        : rsvps.filter((item) => item.attendance === filter),
    [rsvps, filter],
  );

  const stats = useMemo(() => {
    const attending = rsvps.filter((r) => r.attendance === "yes");
    const maybe = rsvps.filter((r) => r.attendance === "maybe");
    const declined = rsvps.filter((r) => r.attendance === "no");
    const guestCount = attending.reduce((sum, r) => sum + r.guests, 0);
    return {
      total: rsvps.length,
      attending: attending.length,
      maybe: maybe.length,
      declined: declined.length,
      guestCount,
    };
  }, [rsvps]);

  const onDelete = async (id: string) => {
    if (!confirm("Remove this RSVP?")) return;
    const res = await fetch(`/api/rsvp/${id}`, { method: "DELETE" });
    if (res.ok) setRsvps((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users size={18} className="text-gold" />
            <h2 className="font-display text-2xl text-cream">RSVP list</h2>
          </div>
          <p className="mt-1 font-body text-sm text-muted">
            Guests who replied through the invitation form
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", `All (${stats.total})`],
              ["yes", `Yes (${stats.attending})`],
              ["maybe", `Maybe (${stats.maybe})`],
              ["no", `No (${stats.declined})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-full border px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.16em] transition",
                filter === id
                  ? "border-gold/50 bg-gold/15 text-gold-soft"
                  : "border-gold/20 text-muted hover:text-cream",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gold/20 bg-[#141018] p-4">
          <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted">
            Responses
          </p>
          <p className="mt-2 font-display text-3xl text-cream">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-gold/20 bg-[#141018] p-4">
          <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted">
            Attending parties
          </p>
          <p className="mt-2 font-display text-3xl text-cream">{stats.attending}</p>
        </div>
        <div className="rounded-2xl border border-gold/20 bg-[#141018] p-4">
          <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted">
            Guest count (yes)
          </p>
          <p className="mt-2 font-display text-3xl text-cream">{stats.guestCount}</p>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((rsvp) => (
          <div
            key={rsvp.id}
            className="rounded-2xl border border-gold/20 bg-[#141018] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-display text-xl text-cream">{rsvp.name}</p>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em]",
                      attendanceStyle[rsvp.attendance],
                    )}
                  >
                    {attendanceLabel[rsvp.attendance]}
                  </span>
                  {rsvp.inviteTier ? (
                    <span className="rounded-full border border-rose-300/30 bg-rose-400/10 px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em] text-rose-100">
                      Bride · {rsvp.inviteTier}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 font-body text-sm text-gold-soft">
                  {rsvp.guests} guest{rsvp.guests === 1 ? "" : "s"}
                  {rsvp.meal && rsvp.meal !== "no-preference"
                    ? ` · ${rsvp.meal.replace("-", " ")}`
                    : ""}
                  {rsvp.email ? ` · ${rsvp.email}` : ""}
                  {rsvp.contactFamily ? ` · via ${rsvp.contactFamily}` : ""}
                  {rsvp.needsAccommodation ? " · needs stay" : ""}
                </p>
                {rsvp.notes ? (
                  <p className="mt-2 font-body text-sm leading-relaxed text-muted">
                    “{rsvp.notes}”
                  </p>
                ) : null}
                <p className="mt-2 font-body text-[11px] text-muted/70">
                  {new Date(rsvp.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(rsvp.id)}
                className="rounded-full border border-red-400/30 p-2 text-red-300 hover:bg-red-400/10"
                aria-label={`Delete RSVP from ${rsvp.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gold/20 p-10 text-center font-body text-sm text-muted">
            No RSVPs yet. Responses from the website will appear here.
          </p>
        ) : null}
      </div>
    </div>
  );
}
