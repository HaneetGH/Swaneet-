"use client";

import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { EventIcon, ManagedEvent } from "@/lib/types";
import {
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  detectPeriod,
  formatDayLabel,
  formatDisplayDate,
  formatDisplayTime,
  isEventDone,
  parseDisplayDate,
  parseDisplayTime,
  partsToTimeISO,
  sortEventsByDateTime,
  timeISOToParts,
  type TimeParts,
} from "@/lib/datetime";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  dateISO: string;
  hour: string;
  minute: string;
  meridiem: "AM" | "PM";
  onwards: boolean;
  period: "morning" | "night" | "none";
  dayOverride: string;
  venue: string;
  venueDetail: string;
  address: string;
  description: string;
  icon: EventIcon;
  done: boolean;
};

const emptyForm: FormState = {
  name: "",
  dateISO: "",
  hour: "12",
  minute: "00",
  meridiem: "PM",
  onwards: false,
  period: "none",
  dayOverride: "",
  venue: "Maple Garden",
  venueDetail: "A Unit of Sukhmani Resort",
  address: "Buria Road, Jagadhri",
  description: "",
  icon: "heart",
  done: false,
};

const fieldClass =
  "w-full rounded-xl border border-gold/25 bg-[#0d0b10] px-3 py-2.5 font-body text-sm text-cream outline-none [color-scheme:dark] focus:border-gold/60";

type EventsManagerProps = {
  initialEvents: ManagedEvent[];
};

function getTimeISO(form: Pick<FormState, "hour" | "minute" | "meridiem">) {
  return partsToTimeISO({
    hour: form.hour,
    minute: form.minute,
    meridiem: form.meridiem,
  });
}

function eventToForm(event: ManagedEvent): FormState {
  const parsedTime = parseDisplayTime(event.time);
  const parts: TimeParts = timeISOToParts(parsedTime.time);
  return {
    name: event.name,
    dateISO: parseDisplayDate(event.date),
    hour: parts.hour,
    minute: parts.minute,
    meridiem: parts.meridiem,
    onwards: parsedTime.onwards,
    period: detectPeriod(event.day),
    dayOverride: "",
    venue: event.venue,
    venueDetail: event.venueDetail,
    address: event.address,
    description: event.description,
    icon: event.icon,
    done: Boolean(event.done),
  };
}

export function EventsManager({ initialEvents }: EventsManagerProps) {
  const [events, setEvents] = useState(() =>
    sortEventsByDateTime(initialEvents),
  );
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const timeISO = useMemo(() => getTimeISO(form), [form]);

  const preview = useMemo(() => {
    if (!form.dateISO) return null;
    return {
      date: formatDisplayDate(form.dateISO),
      time: formatDisplayTime(timeISO, form.onwards),
      day: form.dayOverride || formatDayLabel(form.dateISO, form.period),
    };
  }, [form.dateISO, form.onwards, form.period, form.dayOverride, timeISO]);

  const reset = () => {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
  };

  const onEdit = (event: ManagedEvent) => {
    setEditingId(event.id);
    setForm(eventToForm(event));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.dateISO) {
      setError("Please choose a date");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: form.name,
      date: formatDisplayDate(form.dateISO),
      day: form.dayOverride || formatDayLabel(form.dateISO, form.period),
      time: formatDisplayTime(timeISO, form.onwards),
      venue: form.venue,
      venueDetail: form.venueDetail,
      address: form.address,
      description: form.description,
      icon: form.icon,
      done: form.done,
    };

    try {
      const res = await fetch(
        editingId ? `/api/events/${editingId}` : "/api/events",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string | { formErrors?: string[] };
        event?: ManagedEvent;
      };
      if (!res.ok) {
        const message =
          typeof data.error === "string"
            ? data.error
            : data.error?.formErrors?.[0] ||
              `Could not save event (${res.status})`;
        setError(message);
        return;
      }
      if (!data.event) {
        setError("Could not save event");
        return;
      }

      const saved = data.event;
      if (editingId) {
        setEvents((prev) =>
          sortEventsByDateTime(
            prev.map((item) => (item.id === editingId ? saved : item)),
          ),
        );
      } else {
        setEvents((prev) => sortEventsByDateTime([...prev, saved]));
      }
      reset();
    } catch {
      setError("Could not save event");
    } finally {
      setSaving(false);
    }
  };

  const onToggleDone = async (event: ManagedEvent) => {
    setError("");
    const markDone = !isEventDone(event);

    try {
      const res = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: event.name,
          date: event.date,
          day: event.day,
          time: event.time,
          venue: event.venue,
          venueDetail: event.venueDetail,
          address: event.address,
          description: event.description,
          icon: event.icon,
          done: markDone,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        event?: ManagedEvent;
      };
      if (!res.ok || !data.event) {
        setError(data.error || "Could not update event status");
        return;
      }
      setEvents((prev) =>
        sortEventsByDateTime(
          prev.map((item) => (item.id === event.id ? data.event! : item)),
        ),
      );
      if (editingId === event.id) {
        setForm((f) => ({ ...f, done: Boolean(data.event?.done) }));
      }
    } catch {
      setError("Could not update event status");
    }
  };

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) return;

    setError("");
    setDeletingId(id);
    try {
      const res = await fetch(`/api/events/${encodeURIComponent(id)}`, {
        method: "DELETE",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };

      if (!res.ok) {
        setError(data.error || `Could not delete event (${res.status})`);
        return;
      }

      setEvents((prev) => prev.filter((item) => item.id !== id));
      if (editingId === id) reset();
    } catch {
      setError("Could not delete event. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-cream">Events</h2>
          <span className="font-body text-xs text-muted">{events.length} total</span>
        </div>
        {error ? (
          <p className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        ) : null}
        <div className="space-y-3">
          {events.map((event) => {
            const done = isEventDone(event);
            return (
            <div
              key={event.id}
              className={cn(
                "rounded-2xl border border-gold/20 bg-[#141018] p-4",
                editingId === event.id && "border-gold/50",
                done && "border-emerald-400/25",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-lg text-cream">{event.name}</p>
                    {done ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/10 px-2 py-0.5 font-body text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                        <Check size={11} strokeWidth={2.5} />
                        Done
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-body text-sm text-gold-soft">
                    {event.date} · {event.time}
                  </p>
                  <p className="mt-1 font-body text-xs text-muted">
                    {event.venue}
                    {event.address ? ` · ${event.address}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleDone(event)}
                    className={cn(
                      "rounded-full border p-2 hover:bg-gold/10",
                      done
                        ? "border-emerald-400/40 text-emerald-200"
                        : "border-gold/25 text-gold-soft",
                    )}
                    aria-label={
                      done
                        ? `Mark ${event.name} as upcoming`
                        : `Mark ${event.name} as done`
                    }
                    title={done ? "Mark as upcoming" : "Mark as done"}
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(event)}
                    className="rounded-full border border-gold/25 p-2 text-gold-soft hover:bg-gold/10"
                    aria-label={`Edit ${event.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(event.id, event.name)}
                    disabled={deletingId === event.id}
                    className="rounded-full border border-red-400/30 p-2 text-red-300 hover:bg-red-400/10 disabled:opacity-50"
                    aria-label={`Delete ${event.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
            );
          })}
          {events.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
              No events yet. Create your first one.
            </p>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-gold/20 bg-[#141018] p-5"
      >
        <div className="mb-5 flex items-center gap-2">
          <Plus size={16} className="text-gold" />
          <h3 className="font-display text-xl text-cream">
            {editingId ? "Edit event" : "Create event"}
          </h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Event name
            </span>
            <input
              type="text"
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Date
            </span>
            <input
              type="date"
              className={fieldClass}
              value={form.dateISO}
              onChange={(e) =>
                setForm((f) => ({ ...f, dateISO: e.target.value }))
              }
              required
            />
          </label>

          <div className="sm:col-span-2">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Time
            </span>
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="sr-only">Hour</span>
                <select
                  className={fieldClass}
                  value={form.hour}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hour: e.target.value }))
                  }
                  aria-label="Hour"
                >
                  {HOUR_OPTIONS.map((hour) => (
                    <option key={hour} value={hour}>
                      {hour}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="sr-only">Minute</span>
                <select
                  className={fieldClass}
                  value={form.minute}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, minute: e.target.value }))
                  }
                  aria-label="Minute"
                >
                  {MINUTE_OPTIONS.map((minute) => (
                    <option key={minute} value={minute}>
                      {minute}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="sr-only">AM or PM</span>
                <select
                  className={fieldClass}
                  value={form.meridiem}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      meridiem: e.target.value as "AM" | "PM",
                    }))
                  }
                  aria-label="AM or PM"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </label>
            </div>
            <p className="mt-2 font-body text-xs text-muted">
              Selected: {formatDisplayTime(timeISO, form.onwards)}
            </p>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-gold/20 bg-[#0d0b10] px-3 py-2.5 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.onwards}
              onChange={(e) =>
                setForm((f) => ({ ...f, onwards: e.target.checked }))
              }
              className="h-4 w-4 accent-[#d4af37]"
            />
            <span className="font-body text-sm text-cream">
              Time is “onwards” (e.g. 8:00 PM Onwards)
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Day period
            </span>
            <select
              className={fieldClass}
              value={form.period}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  period: e.target.value as FormState["period"],
                }))
              }
            >
              <option value="none">Auto weekday</option>
              <option value="morning">Morning</option>
              <option value="night">Night</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Day label override
            </span>
            <input
              type="text"
              className={fieldClass}
              value={form.dayOverride}
              onChange={(e) =>
                setForm((f) => ({ ...f, dayOverride: e.target.value }))
              }
              placeholder="Optional custom label"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Venue
            </span>
            <input
              type="text"
              className={fieldClass}
              value={form.venue}
              onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))}
              required
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Venue detail
            </span>
            <input
              type="text"
              className={fieldClass}
              value={form.venueDetail}
              onChange={(e) =>
                setForm((f) => ({ ...f, venueDetail: e.target.value }))
              }
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Address
            </span>
            <input
              className={fieldClass}
              value={form.address}
              onChange={(e) =>
                setForm((f) => ({ ...f, address: e.target.value }))
              }
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Description
            </span>
            <textarea
              rows={3}
              className={cn(fieldClass, "resize-none")}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              Icon
            </span>
            <select
              className={fieldClass}
              value={form.icon}
              onChange={(e) =>
                setForm((f) => ({ ...f, icon: e.target.value as EventIcon }))
              }
            >
              <option value="moon">Moon</option>
              <option value="heart">Heart</option>
              <option value="sun">Sun</option>
              <option value="star">Star</option>
              <option value="sparkles">Sparkles</option>
            </select>
          </label>

          <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.done}
              onChange={(e) =>
                setForm((f) => ({ ...f, done: e.target.checked }))
              }
              className="h-4 w-4 rounded border-gold/40 bg-[#0d0b10] text-gold accent-[#d4af37]"
            />
            <span className="font-body text-sm text-cream">
              Mark as done on the timeline
            </span>
          </label>
        </div>

        {preview ? (
          <div className="mt-4 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3">
            <p className="font-body text-[10px] uppercase tracking-[0.25em] text-gold/70">
              Preview
            </p>
            <p className="mt-1 font-body text-sm text-cream">
              {preview.day ? `${preview.day} · ` : ""}
              {preview.date} · {preview.time}
            </p>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-xs text-red-300">{error}</p> : null}

        <div className="mt-5 flex gap-3">
          <Button type="submit" disabled={saving} className="flex-1">
            {saving ? "Saving…" : editingId ? "Update event" : "Create event"}
          </Button>
          {editingId ? (
            <Button type="button" variant="ghost" onClick={reset}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
