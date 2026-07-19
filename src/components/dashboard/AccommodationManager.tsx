"use client";

import { BedDouble, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { AccommodationRequest } from "@/lib/types";

type AccommodationManagerProps = {
  initialAccommodations: AccommodationRequest[];
};

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

export function AccommodationManager({
  initialAccommodations,
}: AccommodationManagerProps) {
  const [items, setItems] = useState(initialAccommodations);

  const stats = useMemo(() => {
    const people = items.reduce((sum, item) => sum + item.people, 0);
    const rooms = items.reduce((sum, item) => sum + item.rooms, 0);
    return { requests: items.length, people, rooms };
  }, [items]);

  const onDelete = async (id: string) => {
    if (!confirm("Remove this accommodation request?")) return;
    const res = await fetch(`/api/accommodation/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <BedDouble size={18} className="text-gold" />
          <h2 className="font-display text-2xl text-cream">Accommodation</h2>
        </div>
        <p className="mt-1 font-body text-sm text-muted">
          Stay requests submitted after guest sign-in
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gold/20 bg-[#141018] p-4">
          <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted">
            Requests
          </p>
          <p className="mt-2 font-display text-3xl text-cream">{stats.requests}</p>
        </div>
        <div className="rounded-2xl border border-gold/20 bg-[#141018] p-4">
          <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted">
            People
          </p>
          <p className="mt-2 font-display text-3xl text-cream">{stats.people}</p>
        </div>
        <div className="rounded-2xl border border-gold/20 bg-[#141018] p-4">
          <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted">
            Rooms
          </p>
          <p className="mt-2 font-display text-3xl text-cream">{stats.rooms}</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-2xl border border-gold/20 bg-[#141018] p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-xl text-cream">{item.name}</p>
                <p className="mt-2 font-body text-sm text-gold-soft">
                  {item.people} people · {item.rooms} room
                  {item.rooms === 1 ? "" : "s"} · {formatDate(item.checkIn)} →{" "}
                  {formatDate(item.checkOut)}
                </p>
                <p className="mt-1 font-body text-sm text-muted">
                  {item.phone}
                  {item.contactFamily ? ` · via ${item.contactFamily}` : ""}
                </p>
                {item.notes ? (
                  <p className="mt-2 font-body text-sm leading-relaxed text-muted">
                    “{item.notes}”
                  </p>
                ) : null}
                <p className="mt-2 font-body text-[11px] text-muted/70">
                  {new Date(item.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                className="rounded-full border border-red-400/30 p-2 text-red-300 hover:bg-red-400/10"
                aria-label={`Delete stay request from ${item.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gold/20 p-10 text-center font-body text-sm text-muted">
            No accommodation requests yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
