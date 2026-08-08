"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail } from "lucide-react";
import type { EmailKind, EmailLogEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND_LABELS: Record<EmailKind, string> = {
  otp: "Verification code",
  stay: "Stay / accommodation",
  stay_offer: "Stay offer (accept)",
  team_invite: "Team invite",
  team_update: "Team update",
  photo_reject: "Photo rejection",
  wish_received: "Wish received",
  wish_live: "Wish live",
  wish_note: "Wish note",
  owner_alert: "Owner alert",
  face_photos: "Face photo link",
  event_preview: "Tomorrow’s events (legacy)",
  event_thanks: "Day-end thank you (legacy)",
  event_digest: "Evening digest",
};

export function EmailLogManager() {
  const [emails, setEmails] = useState<EmailLogEntry[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "sent" | "failed">("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/emails");
      const data = (await res.json().catch(() => ({}))) as {
        emails?: EmailLogEntry[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not load email log");
        return;
      }
      setEmails(data.emails || []);
    } catch {
      setError("Could not load email log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return emails;
    return emails.filter((entry) => entry.status === filter);
  }, [emails, filter]);

  const sentCount = emails.filter((e) => e.status === "sent").length;
  const failedCount = emails.filter((e) => e.status === "failed").length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Mail size={18} className="text-gold" />
            <h2 className="font-display text-2xl text-cream">Email log</h2>
          </div>
          <p className="font-body text-sm text-muted">
            Outbound email attempts only — sent and failed. Scheduled guest
            updates live under Guest updates.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-gold/25 px-4 py-2 font-body text-[10px] uppercase tracking-[0.18em] text-gold-soft hover:bg-gold/10"
        >
          Refresh
        </button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {(
          [
            ["all", `All (${emails.length})`],
            ["sent", `Sent (${sentCount})`],
            ["failed", `Failed (${failedCount})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "rounded-full px-4 py-2 font-body text-[10px] uppercase tracking-[0.18em] transition",
              filter === id
                ? "bg-gradient-to-r from-gold-deep via-gold to-gold-soft text-[#1a1208]"
                : "border border-gold/20 text-muted hover:text-cream",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : loading ? (
        <p className="font-body text-sm text-muted">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gold/20 p-8 text-center font-body text-sm text-muted">
          {filter === "failed"
            ? "No failed emails recorded."
            : filter === "sent"
              ? "No successful sends recorded yet."
              : "No emails logged yet. Sends appear here after stay, team, OTP, event, or photo emails go out."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gold/20">
          <table className="w-full min-w-[720px] text-left">
            <thead className="bg-[#141018] font-body text-[10px] uppercase tracking-[0.2em] text-muted">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-t border-gold/10 font-body text-sm text-cream align-top"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-muted">
                    {new Date(entry.createdAt).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-gold-soft">
                    {KIND_LABELS[entry.kind] || entry.kind}
                  </td>
                  <td className="px-4 py-3">{entry.to || "—"}</td>
                  <td className="px-4 py-3">
                    <div>{entry.subject}</div>
                    {entry.status === "failed" && entry.error ? (
                      <p className="mt-1 text-xs text-red-300">{entry.error}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]",
                        entry.status === "sent"
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-red-500/15 text-red-200",
                      )}
                    >
                      {entry.status}
                    </span>
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
