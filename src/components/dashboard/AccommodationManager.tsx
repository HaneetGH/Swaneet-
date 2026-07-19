"use client";

import { BedDouble, Mail, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { AccommodationRequest, AccommodationStatus } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type AccommodationManagerProps = {
  initialAccommodations: AccommodationRequest[];
};

const fieldClass =
  "w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none [color-scheme:dark] focus:border-gold/60";

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const statusStyle: Record<AccommodationStatus, string> = {
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  confirmed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  declined: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

export function AccommodationManager({
  initialAccommodations,
}: AccommodationManagerProps) {
  const [items, setItems] = useState(initialAccommodations);
  const [filter, setFilter] = useState<"all" | AccommodationStatus>("all");
  const [openId, setOpenId] = useState<string | null>(
    initialAccommodations[0]?.id || null,
  );
  const [drafts, setDrafts] = useState<Record<string, Partial<AccommodationRequest>>>(
    {},
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const filtered = useMemo(
    () =>
      filter === "all"
        ? items
        : items.filter((item) => (item.status || "pending") === filter),
    [filter, items],
  );

  const stats = useMemo(() => {
    const pending = items.filter((i) => (i.status || "pending") === "pending");
    const confirmed = items.filter((i) => i.status === "confirmed");
    const people = items.reduce((sum, item) => sum + item.people, 0);
    return {
      requests: items.length,
      pending: pending.length,
      confirmed: confirmed.length,
      people,
    };
  }, [items]);

  const draftFor = (item: AccommodationRequest) => ({
    status: item.status || "pending",
    hotelName: item.hotelName || "",
    hotelAddress: item.hotelAddress || "",
    roomDetails: item.roomDetails || "",
    adminNotes: item.adminNotes || "",
    email: item.email || item.authEmail || "",
    ...drafts[item.id],
  });

  const setDraft = (
    id: string,
    patch: Partial<AccommodationRequest> & { status?: AccommodationStatus },
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  };

  const save = async (id: string, sendEmail: boolean) => {
    const draft = drafts[id] || {};
    const current = items.find((item) => item.id === id);
    if (!current) return;

    setSavingId(id);
    setMessage("");
    try {
      const res = await fetch(`/api/accommodation/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draft.status || current.status || "pending",
          hotelName: draft.hotelName ?? current.hotelName ?? "",
          hotelAddress: draft.hotelAddress ?? current.hotelAddress ?? "",
          roomDetails: draft.roomDetails ?? current.roomDetails ?? "",
          adminNotes: draft.adminNotes ?? current.adminNotes ?? "",
          email: draft.email ?? current.email ?? current.authEmail ?? "",
          sendEmail,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        accommodation?: AccommodationRequest;
        email?: { sent?: boolean; error?: string };
      };
      if (!res.ok) {
        setMessage(data.error || "Could not save");
        return;
      }
      if (data.accommodation) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? data.accommodation! : item,
          ),
        );
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
      if (sendEmail) {
        setMessage(
          data.email?.sent
            ? "Saved and email sent to the guest."
            : data.email?.error || "Saved, but email could not be sent.",
        );
      } else {
        setMessage("Saved stay details.");
      }
    } catch {
      setMessage("Could not save. Please try again.");
    } finally {
      setSavingId(null);
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("Remove this accommodation request?")) return;
    const res = await fetch(`/api/accommodation/${id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (openId === id) setOpenId(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <BedDouble size={18} className="text-gold" />
          <h2 className="font-display text-2xl text-cream">Accommodation</h2>
        </div>
        <p className="mt-1 font-body text-sm text-muted">
          Review guest requests, add the stay you can provide, and email details
        </p>
      </div>

      {message ? (
        <p className="mb-4 rounded-xl border border-gold/25 bg-gold/10 px-3 py-2 font-body text-xs text-gold-soft">
          {message}
        </p>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {(
          [
            ["Requests", stats.requests],
            ["Pending", stats.pending],
            ["Confirmed", stats.confirmed],
            ["People", stats.people],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-2xl border border-gold/20 bg-[#141018] p-4"
          >
            <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted">
              {label}
            </p>
            <p className="mt-2 font-display text-3xl text-cream">{value}</p>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["pending", "Pending"],
            ["confirmed", "Confirmed"],
            ["declined", "Declined"],
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

      <div className="space-y-4">
        {filtered.map((item) => {
          const draft = draftFor(item);
          const open = openId === item.id;
          const status = (item.status || "pending") as AccommodationStatus;

          return (
            <div
              key={item.id}
              className="rounded-2xl border border-gold/20 bg-[#141018] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-xl text-cream">{item.name}</p>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 font-body text-[10px] uppercase tracking-[0.14em]",
                        statusStyle[status],
                      )}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="mt-2 font-body text-sm text-gold-soft">
                    Asked: {item.people} people · {item.rooms} room
                    {item.rooms === 1 ? "" : "s"} · {formatDate(item.checkIn)} →{" "}
                    {formatDate(item.checkOut)}
                  </p>
                  <p className="mt-1 font-body text-sm text-muted">
                    {item.phone}
                    {(item.email || item.authEmail)
                      ? ` · ${item.email || item.authEmail}`
                      : ""}
                    {item.contactFamily ? ` · via ${item.contactFamily}` : ""}
                  </p>
                  {item.notes ? (
                    <p className="mt-2 font-body text-sm text-muted">
                      Guest note: “{item.notes}”
                    </p>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="rounded-full border border-red-400/30 p-2 text-red-300 hover:bg-red-400/10"
                  aria-label={`Delete stay request from ${item.name}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {open ? (
                <div className="mt-5 space-y-3 border-t border-gold/15 pt-5">
                  <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
                    Family response
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                        Status
                      </span>
                      <select
                        className={cn(fieldClass, "appearance-none")}
                        value={draft.status}
                        onChange={(e) =>
                          setDraft(item.id, {
                            status: e.target.value as AccommodationStatus,
                          })
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed — we can provide</option>
                        <option value="declined">Declined — cannot arrange</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                        Guest email
                      </span>
                      <input
                        type="email"
                        className={fieldClass}
                        value={draft.email || ""}
                        onChange={(e) =>
                          setDraft(item.id, { email: e.target.value })
                        }
                        placeholder="for confirmation email"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                      Hotel / stay name
                    </span>
                    <input
                      className={fieldClass}
                      value={draft.hotelName || ""}
                      onChange={(e) =>
                        setDraft(item.id, { hotelName: e.target.value })
                      }
                      placeholder="e.g. Maple Garden guest rooms"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                      Address
                    </span>
                    <input
                      className={fieldClass}
                      value={draft.hotelAddress || ""}
                      onChange={(e) =>
                        setDraft(item.id, { hotelAddress: e.target.value })
                      }
                      placeholder="Full address / map pin"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                      Room details
                    </span>
                    <input
                      className={fieldClass}
                      value={draft.roomDetails || ""}
                      onChange={(e) =>
                        setDraft(item.id, { roomDetails: e.target.value })
                      }
                      placeholder="Room type, floor, sharing, etc."
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                      Message to guest
                    </span>
                    <textarea
                      rows={3}
                      className={cn(fieldClass, "resize-none")}
                      value={draft.adminNotes || ""}
                      onChange={(e) =>
                        setDraft(item.id, { adminNotes: e.target.value })
                      }
                      placeholder="Check-in time, contact person, anything else"
                    />
                  </label>

                  {item.emailSentAt ? (
                    <p className="font-body text-[11px] text-muted">
                      Last email sent {new Date(item.emailSentAt).toLocaleString()}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingId === item.id}
                      onClick={() => save(item.id, false)}
                    >
                      <Save size={14} />
                      {savingId === item.id ? "Saving…" : "Save details"}
                    </Button>
                    <Button
                      type="button"
                      disabled={savingId === item.id}
                      onClick={() => save(item.id, true)}
                    >
                      <Mail size={14} />
                      Save & email guest
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gold/20 p-10 text-center font-body text-sm text-muted">
            No accommodation requests in this filter.
          </p>
        ) : null}
      </div>
    </div>
  );
}
