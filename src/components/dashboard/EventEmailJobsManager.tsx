"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import type {
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
  next: {
    asOfDateKey: string;
    targetDateKey: string;
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
    recipients: Array<{ email: string; name: string; skipped?: string }>;
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
  const [previewTime, setPreviewTime] = useState("20:00");
  const [thanksTime, setThanksTime] = useState("22:30");
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const [thanksEnabled, setThanksEnabled] = useState(true);
  const [asOf, setAsOf] = useState("");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [message, setMessage] = useState("");

  const applyDashboard = useCallback((data: Dashboard) => {
    setDashboard(data);
    setPreviewTime(data.config.previewTimeIst);
    setThanksTime(data.config.thanksTimeIst);
    setPreviewEnabled(data.config.previewEnabled);
    setThanksEnabled(data.config.thanksEnabled);
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
      {
        action: "update",
        previewEnabled,
        thanksEnabled,
        previewTimeIst: previewTime,
        thanksTimeIst: thanksTime,
      },
      "save",
    );
    if (data) setMessage("Schedule saved. Hourly cron uses these IST times.");
  };

  const cancelJob = async (job: JobCard) => {
    if (
      !confirm(
        `Cancel ${job.label} for ${job.next.label}? Guests will not get that email unless you uncancel or send manually.`,
      )
    ) {
      return;
    }
    const data = await post(
      {
        action: "cancel",
        phase: job.phase,
        asOfDateKey: job.next.asOfDateKey,
        reason: "Cancelled from dashboard",
      },
      `cancel-${job.phase}`,
    );
    if (data) setMessage(`${job.label} cancelled for ${job.next.asOfDateKey}`);
  };

  const uncancelJob = async (job: JobCard) => {
    const data = await post(
      {
        action: "uncancel",
        phase: job.phase,
        asOfDateKey: job.next.asOfDateKey,
      },
      `uncancel-${job.phase}`,
    );
    if (data) setMessage(`${job.label} re-enabled for ${job.next.asOfDateKey}`);
  };

  const runJob = async (phase: EventEmailPhase, dryRun: boolean) => {
    if (
      !dryRun &&
      !confirm(
        phase === "preview"
          ? "Send tomorrow’s event emails now?"
          : "Send today’s thank-you emails now?",
      )
    ) {
      return;
    }
    setRunResult(null);
    const data = await post(
      {
        action: "run",
        phase,
        dryRun,
        asOfDateKey: asOf.trim() || undefined,
      },
      `${phase}-${dryRun ? "dry" : "send"}`,
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
              <h3 className="font-display text-xl text-cream">
                Guest updates
              </h3>
            </div>
            <p className="mt-1 font-body text-sm text-muted">
              Scheduled outreach for celebration days (email today; more
              channels can land here later). Night-before preview + day-end
              thank-you. Times are IST; hourly cron checks a ~55 min window.
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

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="rounded-xl border border-gold/15 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-lg text-cream">
                Tomorrow preview
              </span>
              <input
                type="checkbox"
                checked={previewEnabled}
                onChange={(e) => setPreviewEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#d4af37]"
              />
            </div>
            <p className="mt-1 font-body text-xs text-muted">
              Email about next day’s events
            </p>
            <input
              type="time"
              value={previewTime}
              onChange={(e) => setPreviewTime(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gold/25 bg-[#0d0b10] px-3 py-2 font-body text-sm text-cream"
            />
          </label>

          <label className="rounded-xl border border-gold/15 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-lg text-cream">
                Day-end thank you
              </span>
              <input
                type="checkbox"
                checked={thanksEnabled}
                onChange={(e) => setThanksEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#d4af37]"
              />
            </div>
            <p className="mt-1 font-body text-xs text-muted">
              Gist of today + upload / gallery / wishes links
            </p>
            <input
              type="time"
              value={thanksTime}
              onChange={(e) => setThanksTime(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gold/25 bg-[#0d0b10] px-3 py-2 font-body text-sm text-cream"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={busy === "save"}
          onClick={() => void saveSchedule()}
          className="mt-4 rounded-full bg-gradient-to-r from-gold-deep via-gold to-gold-soft px-5 py-2.5 font-body text-[10px] uppercase tracking-[0.18em] text-[#1a1208] disabled:opacity-50"
        >
          {busy === "save" ? "Saving…" : "Save schedule"}
        </button>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        {message ? (
          <p className="mt-3 text-sm text-emerald-200">{message}</p>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(dashboard?.jobs || []).map((job) => (
          <div
            key={job.phase}
            className="rounded-2xl border border-gold/20 bg-[#141018] p-5"
          >
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
            <p className="mt-1 font-body text-xs text-muted">
              About {job.next.targetDateKey}
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

            <div className="mt-4 flex flex-wrap gap-2">
              {job.next.cancelled ? (
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void uncancelJob(job)}
                  className="rounded-full border border-emerald-400/30 px-3 py-2 font-body text-[10px] uppercase tracking-[0.16em] text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-50"
                >
                  Uncancel
                </button>
              ) : (
                <button
                  type="button"
                  disabled={Boolean(busy) || job.next.alreadyDone}
                  onClick={() => void cancelJob(job)}
                  className="rounded-full border border-amber-400/30 px-3 py-2 font-body text-[10px] uppercase tracking-[0.16em] text-amber-200 hover:bg-amber-400/10 disabled:opacity-50"
                >
                  Cancel next
                </button>
              )}
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void runJob(job.phase, true)}
                className="rounded-full border border-gold/25 px-3 py-2 font-body text-[10px] uppercase tracking-[0.16em] text-gold-soft hover:bg-gold/10 disabled:opacity-50"
              >
                Dry run
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void runJob(job.phase, false)}
                className="rounded-full border border-emerald-400/30 px-3 py-2 font-body text-[10px] uppercase tracking-[0.16em] text-emerald-200 hover:bg-emerald-400/10 disabled:opacity-50"
              >
                Send now
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gold/20 bg-[#141018] p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h4 className="font-display text-xl text-cream">Manual run</h4>
            <p className="mt-1 font-body text-xs text-muted">
              Optional as-of IST date for testing a wedding day early
            </p>
          </div>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="rounded-lg border border-gold/25 bg-[#0d0b10] px-3 py-2 font-body text-sm text-cream"
          />
        </div>

        {runResult ? (
          <div className="mt-4 space-y-2 font-body text-sm text-muted">
            <p className="text-cream">
              {runResult.dryRun ? "Dry run" : "Sent"} · {runResult.phase} ·
              target {runResult.targetDateKey} · {runResult.sent} sent ·{" "}
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

      <div className="rounded-2xl border border-gold/20 overflow-hidden">
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
                    className="border-t border-gold/10 font-body text-sm text-cream align-top"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {new Date(run.finishedAt).toLocaleString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-gold-soft">
                      {run.phase === "preview" ? "Tomorrow" : "Day-end"}
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
