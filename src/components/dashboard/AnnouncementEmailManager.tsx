"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";

type Wave = "today" | "tomorrow" | "apology";

type RecipientRow = {
  email: string;
  name: string;
  sources: string[];
  site?: string;
  skipped?: string;
};

type RunResult = {
  wave: Wave;
  dryRun: boolean;
  recipientCount: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
  recipients: RecipientRow[];
};

export function AnnouncementEmailManager() {
  const [wave, setWave] = useState<Wave>("apology");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  const loadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements");
      const data = (await res.json().catch(() => ({}))) as {
        recipientCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not load recipients");
        return;
      }
      setPreviewCount(data.recipientCount ?? 0);
    } catch {
      setError("Could not load recipients");
    }
  }, []);

  useEffect(() => {
    void loadCount();
  }, [loadCount]);

  const run = async (dryRun: boolean) => {
    const confirmLabel =
      wave === "apology"
        ? "Send the APOLOGY email now? Main = Dashboard Events only. Mehfil = bride invite schedule (Panipat + wedding). Main-only events like Roka / 11th Sangeet will not appear on Mehfil."
        : `Send the ${wave === "tomorrow" ? "reminder" : "arrival"} email to all guests (RSVP, stay, wishes, logins) now?`;
    if (!dryRun && !confirm(confirmLabel)) {
      return;
    }

    setBusy(dryRun ? "dry" : "send");
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wave, dryRun, force: false }),
      });
      const data = (await res.json().catch(() => ({}))) as RunResult & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      setResult(data);
      setMessage(
        dryRun
          ? `Dry run ready · ${data.recipientCount} guest rows by invite site (${data.skipped} already sent for this wave)`
          : `Sent ${data.sent} · skipped ${data.skipped} · failed ${data.failed}`,
      );
      void loadCount();
    } catch {
      setError("Request failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mb-10 rounded-2xl border border-gold/20 bg-[#141018] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-gold" />
            <h3 className="font-display text-xl text-cream">
              Arrival announcement
            </h3>
          </div>
          <p className="mt-1 max-w-xl font-body text-sm text-muted">
            Main emails use Dashboard → Events only (Roka, main Sangeet, Dinner…).
            Mehfil/Laavan use their invite schedules; dashboard edits apply only
            when the event has the same name and date as an invite event — main-only
            events never appear on Mehfil mail.
          </p>
          <p className="mt-2 font-body text-xs text-gold-soft/90">
            Guest rows ready: {previewCount === null ? "…" : previewCount}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCount()}
          className="rounded-full border border-gold/25 px-4 py-2 font-body text-[10px] uppercase tracking-[0.18em] text-gold-soft hover:bg-gold/10"
        >
          Refresh count
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(
          [
            ["apology", "Apology / correct schedule"],
            ["today", "Send today"],
            ["tomorrow", "Tomorrow reminder"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setWave(id)}
            className={cn(
              "rounded-full px-4 py-2 font-body text-[10px] uppercase tracking-[0.18em] transition",
              wave === id
                ? "bg-gold/20 text-gold-soft"
                : "border border-gold/20 text-muted hover:text-cream",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-3 font-body text-xs text-muted">
        {wave === "apology"
          ? "Main: dashboard Events only. Mehfil: Panipat bride ceremonies + wedding (no main-only Roka / 11th Sangeet). Laavan: wedding-side invite events."
          : wave === "tomorrow"
            ? "Subject starts with “Reminder · …” so you can send again tomorrow without colliding with today’s send."
            : "Normal arrival note, still split by invite site — schedule from Events / invite."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void run(true)}
          className="rounded-full border border-gold/25 px-4 py-2.5 font-body text-[10px] uppercase tracking-[0.18em] text-gold-soft hover:bg-gold/10 disabled:opacity-50"
        >
          {busy === "dry" ? "Previewing…" : "Dry run"}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void run(false)}
          className="rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft px-5 py-2.5 font-body text-[10px] uppercase tracking-[0.18em] text-[#1a1208] disabled:opacity-50"
        >
          {busy === "send" ? "Sending…" : "Send now"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
      {message ? (
        <p className="mt-3 text-sm text-emerald-200">{message}</p>
      ) : null}

      {result ? (
        <div className="mt-5 max-h-64 overflow-auto rounded-xl border border-gold/15">
          <table className="w-full text-left font-body text-xs text-cream/90">
            <thead className="sticky top-0 bg-[#1a1620] text-[10px] uppercase tracking-[0.16em] text-muted">
              <tr>
                <th className="px-3 py-2">Guest</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Invite</th>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {result.recipients.slice(0, 80).map((row) => (
                <tr
                  key={`${row.email}:${row.site || "main"}`}
                  className="border-t border-gold/10"
                >
                  <td className="px-3 py-2">{row.name}</td>
                  <td className="px-3 py-2 text-muted">{row.email}</td>
                  <td className="px-3 py-2 text-muted">{row.site || "main"}</td>
                  <td className="px-3 py-2 text-muted">
                    {row.sources.join(" + ")}
                  </td>
                  <td className="px-3 py-2 text-amber-200/90">
                    {row.skipped || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.recipients.length > 80 ? (
            <p className="border-t border-gold/10 px-3 py-2 text-[11px] text-muted">
              Showing first 80 of {result.recipients.length}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
