"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BedDouble, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type OfferStay = {
  id: string;
  name: string;
  status: string;
  offerStatus?: string;
  hotelName?: string;
  roomDetails?: string;
  people: number;
  requestedLabel: string;
  offeredLabel: string;
  requestedNights: number;
  offeredNights: number;
};

function StayOfferInner() {
  const search = useSearchParams();
  const token = search.get("t") || "";
  const [stay, setStay] = useState<OfferStay | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) {
      setError("Missing offer link. Open the link from your email.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/accommodation/offer?t=${encodeURIComponent(token)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        stay?: OfferStay;
      };
      if (!res.ok) {
        setError(data.error || "Could not open this offer");
        setStay(null);
        return;
      }
      setStay(data.stay || null);
      setError("");
    } catch {
      setError("Could not load offer");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = async (action: "accept" | "decline") => {
    if (!token) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/accommodation/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        stay?: OfferStay;
      };
      if (!res.ok) {
        setError(data.error || "Could not submit your reply");
        return;
      }
      setMessage(data.message || "Saved.");
      if (data.stay) {
        setStay((prev) =>
          prev
            ? {
                ...prev,
                ...data.stay,
                offerStatus: data.stay?.offerStatus || prev.offerStatus,
                status: data.stay?.status || prev.status,
              }
            : prev,
        );
      }
      await load();
    } catch {
      setError("Could not submit your reply");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="ambient-bg flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-lg border border-gold/25 bg-[#120e16] px-6 py-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
        <p className="font-body text-[10px] uppercase tracking-[0.32em] text-gold/70">
          Stay offer
        </p>
        <h1 className="mt-2 font-display text-3xl text-cream">
          Revised accommodation
        </h1>

        {loading ? (
          <p className="mt-6 font-body text-sm text-muted">Loading…</p>
        ) : error && !stay ? (
          <p className="mt-6 font-body text-sm text-rose-200">{error}</p>
        ) : stay ? (
          <div className="mt-6 space-y-4">
            <p className="font-body text-sm text-muted">
              Hi {stay.name || "guest"} — please review the dates we can offer.
            </p>

            <div className="border border-gold/20 bg-[#0d0b10] px-4 py-4">
              <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                You asked
              </p>
              <p className="mt-1 font-display text-xl text-cream/80">
                {stay.requestedLabel}
              </p>
              <p className="font-body text-xs text-muted">
                {stay.requestedNights} night
                {stay.requestedNights === 1 ? "" : "s"}
              </p>

              <p className="mt-4 font-body text-[10px] uppercase tracking-[0.2em] text-gold/70">
                We can offer
              </p>
              <p className="mt-1 font-display text-2xl text-cream">
                {stay.offeredLabel}
              </p>
              <p className="font-body text-xs text-gold-soft">
                {stay.offeredNights} night
                {stay.offeredNights === 1 ? "" : "s"}
                {stay.hotelName ? ` · ${stay.hotelName}` : ""}
              </p>
              {stay.roomDetails ? (
                <p className="mt-2 font-body text-sm text-muted">
                  {stay.roomDetails}
                </p>
              ) : null}
            </div>

            {message ? (
              <p className="font-body text-sm text-gold-soft">{message}</p>
            ) : null}
            {error ? (
              <p className="font-body text-sm text-rose-200">{error}</p>
            ) : null}

            {stay.offerStatus === "accepted" ? (
              <p className="inline-flex items-center gap-2 font-body text-sm text-emerald-200">
                <Check size={16} /> Stay accepted — you’re confirmed.
              </p>
            ) : stay.offerStatus === "declined" ? (
              <p className="inline-flex items-center gap-2 font-body text-sm text-rose-200">
                <X size={16} /> Offer declined.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void respond("accept")}
                >
                  <BedDouble size={14} />
                  {busy ? "Saving…" : "Accept this stay"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (
                      !confirm(
                        "Decline this offer? The family will release the room.",
                      )
                    ) {
                      return;
                    }
                    void respond("decline");
                  }}
                >
                  Decline
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default function StayOfferPage() {
  return (
    <Suspense
      fallback={
        <main className="ambient-bg flex min-h-screen items-center justify-center px-5">
          <p className="font-body text-sm text-muted">Loading…</p>
        </main>
      }
    >
      <StayOfferInner />
    </Suspense>
  );
}
