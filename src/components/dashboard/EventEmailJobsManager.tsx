"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import type {
  EventEmailAudienceScope,
  EventEmailJobCancel,
  EventEmailJobConfig,
  EventEmailJobRun,
  EventEmailPhase,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type JobCard = {
  phase: EventEmailPhase;
  label: string;
  enabled: boolean;
  timeIst: string;
  scope: EventEmailAudienceScope;
  scopeLabel: string;
  next: {
    asOfDateKey: string;
    todayDateKey: string;
    tomorrowDateKey: string;
    atIso: string;
    label: string;
    cancelled: boolean;
    cancelReason?: string;
    alreadyDone: boolean;
    estimatedRecipients: number;
    eventNames: string[];
  };
};

type Dashboard = {
  config: EventEmailJobConfig;
  jobs: JobCard[];
  cancels: EventEmailJobCancel[];
  runs: EventEmailJobRun[];
  nowIst: string;
};

type RunResult = {
  phase: EventEmailPhase;
  asOfDateKey: string;
  targetDateKey: string;
  dryRun: boolean;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
  plans: Array<{
    site: string;
    dayLabel: string;
    eventNames: string[];
    recipientCount: number;
  }>;
};

const RUN_STATUS: Record<EventEmailJobRun["status"], string> = {
  ran: "Ran",
  skipped: "Skipped",
  cancelled: "Cancelled",
  failed: "Failed",
  dry_run: "Dry run",
};

export function EventEmailJobsManager() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [timeIst, setTimeIst] = useState("21:00");
  const [enabled, setEnabled] = useState(true);
  const [scope, setScope] = useState<EventEmailAudienceScope>("all");
  const [asOf, setAsOf] = useState("");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [message, setMessage] = useState("");

  const applyDashboard = useCallback((data: Dashboard) => {
    setDashboard(data);
    setTimeIst(data.config.timeIst);
    setEnabled(data.config.enabled);
    setScope(data.config.scope || "all");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/event-email-jobs");
      const data = (await res.json().catch(() => ({}))) as Dashboard & {
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not load event jobs");
        return;
      }
      applyDashboard(data);
    } catch {
      setError("Could not load event jobs");
    } finally {
      setLoading(false);
    }
  }, [applyDashboard]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>, busyKey: string) => {
    setBusy(busyKey);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/event-email-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        dashboard?: Dashboard;
        result?: RunResult;
        blocked?: string;
        ok?: boolean;
      };
      if (!res.ok) {
        setError(data.error || "Request failed");
        return null;
      }
      if (data.dashboard) applyDashboard(data.dashboard);
      return data;
    } catch {
      setError("Request failed");
      return null;
    } finally {
      setBusy(null);
    }
  };

  const saveSchedule = async () => {
    const data = await post(
      { action: "update", enabled, timeIst, scope },
      "save",
    );
    if (data) {
      setMessage(
        "Schedule saved. Digest only covers the selected site scope.",
      );
    }
  };

  const job = dashboard?.jobs[0];

  const cancelJob = async () => {
    if (!job) return;
    if (
      !confirm(
        `Cancel tonight’s digest for ${job.next.label}? Guests will not get that email unless you uncancel or send manually.`,
      )
    ) {
      return;
    }
    const data = await post(
      {
        action: "cancel",
        asOfDateKey: job.next.asOfDateKey,
        reason: "Cancelled from dashboard",
      },
      "cancel",
    );
    if (data) setMessage(`Digest cancelled for ${job.next.asOfDateKey}`);
  };

  const uncancelJob = async () => {
    if (!job) return;
    const data = await post(
      {
        action: "uncancel",
        asOfDateKey: job.next.asOfDateKey,
      },
      "uncancel",
    );
    if (data) setMessage(`Digest re-enabled for ${job.next.asOfDateKey}`);
  };

  const runJob = async (dryRun: boolean) => {
    if (!dryRun && !confirm("Send the evening digest email to guests now?")) {
      return;
    }
    setRunResult(null);
    const data = await post(
      {
        action: "run",
        dryRun,
        asOfDateKey: asOf.trim() || undefined,
      },
      dryRun ? "dry" : "send",
    );
    if (data?.result) {
      setRunResult(data.result);
      setMessage(
        dryRun
          ? "Dry run complete — nothing sent."
          : `Send finished · ${data.result.sent} sent`,
      );
    } else if (data?.blocked) {
      setMessage(data.blocked);
    }
  };

  if (loading && !dashboard) {
    return (
      <p className="mb-8 font-body text-sm text-muted">Loading event jobs…</p>
    );
  }

  return (
    <div className="mb-10 space-y-5">
      <div className="rounded-2xl border border-gold/20 bg-[#141018] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarClock size={18} className="text-gold" />
              <h3 className="font-display text-xl text-cream">Guest updates</h3>
            </div>
            <p className="mt-1 font-body text-sm text-muted">
              One evening email with today’s thank-you, tomorrow’s schedule, and
              links. Choose whether cron covers the main (groom) site, bride
              invite sites, or both. Auto-send is once daily (~9:00 PM IST).
              Now:{" "}
              <span className="text-cream">{dashboard?.nowIst || "—"}</span>
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

        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="rounded-xl border border-gold/15 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-lg text-cream">
                Evening digest
              </span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#d4af37]"
              />
            </div>
            <p className="mt-1 font-body text-xs text-muted">
              Send time (IST label). Hobby cron is fixed in{" "}
              <code className="text-cream/80">vercel.json</code>.
            </p>
            <input
              type="time"
              value={timeIst}
              onChange={(e) => setTimeIst(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gold/25 bg-[#0d0b10] px-3 py-2 font-body text-sm text-cream"
            />
          </label>
          <label className="rounded-xl border border-gold/15 p-4">
            <span className="font-display text-lg text-cream">Audience</span>
            <p className="mt-1 font-body text-xs text-muted">
              Only guests + events for this site group are emailed.
            </p>
            <select
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as EventEmailAudienceScope)
              }
              className="mt-3 w-full rounded-lg border border-gold/25 bg-[#0d0b10] px-3 py-2 font-body text-sm text-cream"
            >
              <option value="all">All guests (main + bride)</option>
              <option value="main">Main site only (groom / #Swaneet)</option>
              <option value="bride">Bride sites only (Mehfil + Laavan)</option>
            </select>
          </label>
          <button
            type="button"
            disabled={busy === "save"}
            onClick={() => void saveSchedule()}
            className="rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft px-5 py-2.5 font-body text-[10px] uppercase tracking-[0.18em] text-[#1a1208] disabled:opacity-50"
          >
            {busy === "save" ? "Saving…" : "Save schedule"}
          </button>
        </div>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        {message ? (
          <p className="mt-3 text-sm text-emerald-200">{message}</p>
        ) : null}
      </div>

      {job ? (
        <div className="rounded-2xl border border-gold/20 bg-[#141018] p-5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.22em] text-gold/70">
                Next run
              </p>
              <h4 className="mt-1 font-display text-2xl text-cream">
                {job.label}
              </h4>
            </div>
            <span
              className={cn(
                "rounded-full px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.16em]",
                job.enabled
                  ? "bg-emerald-500/15 text-emerald-200"
                  : "bg-red-500/15 text-red-200",
              )}
            >
              {job.enabled ? "On" : "Off"}
            </span>
          </div>

          <p className="mt-3 font-body text-sm text-cream">{job.next.label}</p>
          <p className="mt-1 font-body text-xs text-gold-soft/90">
            {job.scopeLabel || "All guests (main + bride)"}
          </p>
          <p className="mt-1 font-body text-xs text-muted">
            Today {job.next.todayDateKey} · Tomorrow {job.next.tomorrowDateKey}
            {job.next.eventNames.length
              ? ` · ${job.next.eventNames.join(" · ")}`
              : " · no events planned"}
            {` · ~${job.next.estimatedRecipients} guest${
              job.next.estimatedRecipients === 1 ? "" : "s"
            }`}
          </p>

          {job.next.cancelled ? (
            <p className="mt-2 text-sm text-amber-200">
              Cancelled
              {job.next.cancelReason ? ` — ${job.next.cancelReason}` : ""}
            </p>
          ) : null}
          {job.next.alreadyDone ? (
            <p className="mt-2 text-sm text-muted">
              Already completed for that IST day
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="mr-2">
              <span className="mb-1 block font-body text-[10px] uppercase tracking-[0.18em] text-muted">
                As-of date (optional)
              </span>
              <input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="rounded-lg border border-gold/25 bg-[#0d0b10] px-3 py-2 font-body text-sm text-cream"
              />
            </label>
            {job.next.cancelled ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void uncancelJob()}
                className="rounded-full border border-emerald-400/30 px-3 py-2 font-body text-[10px] uppercase tracking-[0.16em] text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-50"
              >
                Uncancel
              </button>
            ) : (
              <button
                type="button"
                disabled={Boolean(busy) || job.next.alreadyDone}
                onClick={() => void cancelJob()}
                className="rounded-full border border-amber-400/30 px-3 py-2 font-body text-[10px] uppercase tracking-[0.16em] text-amber-200 hover:bg-amber-400/10 disabled:opacity-50"
              >
                Cancel next
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void runJob(true)}
              className="rounded-full border border-gold/25 px-3 py-2 font-body text-[10px] uppercase tracking-[0.16em] text-gold-soft hover:bg-gold/10 disabled:opacity-50"
            >
              Dry run
            </button>
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => void runJob(false)}
              className="rounded-full border border-emerald-400/30 px-3 py-2 font-body text-[10px] uppercase tracking-[0.16em] text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-50"
            >
              Send now
            </button>
          </div>

          {runResult ? (
            <div className="mt-4 space-y-2 font-body text-sm text-muted">
              <p className="text-cream">
                {runResult.dryRun ? "Dry run" : "Sent"} ·{" "}
                {runResult.asOfDateKey} · {runResult.sent} sent ·{" "}
                {runResult.skipped} skipped · {runResult.failed} failed
              </p>
              {runResult.plans.map((plan) => (
                <p key={`${plan.site}-${plan.dayLabel}`}>
                  {plan.site}: {plan.eventNames.join(", ") || "—"} (
                  {plan.recipientCount})
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-gold/20">
        <div className="border-b border-gold/15 bg-[#141018] px-5 py-4">
          <h4 className="font-display text-xl text-cream">Job history</h4>
          <p className="mt-1 font-body text-xs text-muted">
            Cron and manual runs (newest first)
          </p>
        </div>
        {(dashboard?.runs || []).length === 0 ? (
          <p className="p-6 font-body text-sm text-muted">No job runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-[#141018] font-body text-[10px] uppercase tracking-[0.2em] text-muted">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Job</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent</th>
                </tr>
              </thead>
              <tbody>
                {(dashboard?.runs || []).map((run) => (
                  <tr
                    key={run.id}
                    className="border-t border-gold/10 align-top font-body text-sm text-cream"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {new Date(run.finishedAt).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-gold-soft">
                      {run.phase === "digest"
                        ? "Digest"
                        : run.phase === "preview"
                          ? "Tomorrow (legacy)"
                          : "Day-end (legacy)"}
                    </td>
                    <td className="px-4 py-3">
                      {run.targetDateKey}
                      {run.note ? (
                        <p className="mt-1 text-xs text-muted">{run.note}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{run.trigger}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]",
                          run.status === "ran"
                            ? "bg-emerald-500/15 text-emerald-200"
                            : run.status === "failed"
                              ? "bg-red-500/15 text-red-200"
                              : run.status === "cancelled"
                                ? "bg-amber-500/15 text-amber-200"
                                : "bg-white/5 text-muted",
                        )}
                      >
                        {RUN_STATUS[run.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      {run.sent}/{run.recipientCount}
                      {run.failed ? ` · ${run.failed} fail` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
