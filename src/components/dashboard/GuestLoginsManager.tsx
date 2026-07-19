"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import type { GuestLogin } from "@/lib/types";

export function GuestLoginsManager() {
  const [guests, setGuests] = useState<GuestLogin[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/guests")
      .then(async (res) => {
        if (!res.ok) throw new Error("Could not load guests");
        return res.json();
      })
      .then((data: { guests?: GuestLogin[] }) => {
        if (alive) setGuests(data.guests || []);
      })
      .catch(() => {
        if (alive) setError("Could not load logged-in guests");
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <UserRound size={18} className="text-gold" />
        <h2 className="font-display text-2xl text-cream">Logged-in guests</h2>
      </div>
      <p className="mb-6 font-body text-sm text-muted">
        People who signed in with Google for stay requests or photo sharing.
      </p>

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : guests.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
          No guest sign-ins recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gold/20">
          <table className="w-full min-w-[640px] text-left">
            <thead className="bg-[#141018] font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Used for</th>
                <th className="px-4 py-3">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <tr
                  key={guest.uid}
                  className="border-t border-gold/10 font-body text-sm text-cream"
                >
                  <td className="px-4 py-3">{guest.name || "—"}</td>
                  <td className="px-4 py-3 text-muted">
                    {guest.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-gold-soft">
                    {guest.sources.join(", ")}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(guest.lastSeenAt).toLocaleString("en-IN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
