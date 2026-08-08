import {
  istDateKey,
  planEventEmails,
  runEventEmails,
  shiftDateKey,
  type EventEmailRunResult,
} from "@/lib/event-emails";
import {
  getEventEmailJobCancels,
  getEventEmailJobConfig,
  listEventEmailJobRuns,
  recordEventEmailJobRun,
  removeEventEmailJobCancel,
  setEventEmailJobCancel,
  updateEventEmailJobConfig,
} from "@/lib/store";
import type {
  EventEmailJobCancel,
  EventEmailJobConfig,
  EventEmailJobRun,
  EventEmailPhase,
} from "@/lib/types";

export const DEFAULT_EVENT_EMAIL_JOB_CONFIG: EventEmailJobConfig = {
  enabled: true,
  timeIst: "21:00",
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeTimeIst(value: string | undefined, fallback: string) {
  const trimmed = value?.trim() || "";
  return TIME_RE.test(trimmed) ? trimmed : fallback;
}

export function normalizeEventEmailJobConfig(
  raw?: Partial<EventEmailJobConfig> | null,
): EventEmailJobConfig {
  const legacyEnabled =
    raw?.previewEnabled === false && raw?.thanksEnabled === false
      ? false
      : undefined;
  const legacyTime =
    normalizeTimeIst(raw?.previewTimeIst, "") ||
    normalizeTimeIst(raw?.thanksTimeIst, "") ||
    "";

  return {
    enabled:
      typeof raw?.enabled === "boolean"
        ? raw.enabled
        : legacyEnabled === undefined
          ? true
          : legacyEnabled,
    timeIst: normalizeTimeIst(
      raw?.timeIst || legacyTime || undefined,
      DEFAULT_EVENT_EMAIL_JOB_CONFIG.timeIst,
    ),
    updatedAt: raw?.updatedAt,
  };
}

/** IST wall-clock parts for a Date. */
export function istClock(now = new Date()): {
  dateKey: string;
  hour: number;
  minute: number;
  minutesFromMidnight: number;
} {
  const dateKey = istDateKey(now);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value || "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value || "0");
  return {
    dateKey,
    hour,
    minute,
    minutesFromMidnight: hour * 60 + minute,
  };
}

export function timeIstToMinutes(timeIst: string): number {
  const normalized = normalizeTimeIst(timeIst, "00:00");
  const [h, m] = normalized.split(":").map(Number);
  return h * 60 + m;
}

/** True when now is inside [scheduled, scheduled + windowMinutes). */
export function isWithinScheduleWindow(
  nowMinutes: number,
  scheduledTimeIst: string,
  windowMinutes = 55,
): boolean {
  const start = timeIstToMinutes(scheduledTimeIst);
  const end = start + windowMinutes;
  return nowMinutes >= start && nowMinutes < end;
}

export function phaseLabel(phase: EventEmailPhase) {
  if (phase === "digest") return "Evening digest";
  return phase === "preview" ? "Tomorrow preview (legacy)" : "Day-end (legacy)";
}

function cancelKey(phase: EventEmailPhase, asOfDateKey: string) {
  return `${phase}:${asOfDateKey}`;
}

export function findCancel(
  cancels: EventEmailJobCancel[],
  phase: EventEmailPhase,
  asOfDateKey: string,
) {
  const key = cancelKey(phase, asOfDateKey);
  return (
    cancels.find((item) => cancelKey(item.phase, item.asOfDateKey) === key) ||
    null
  );
}

export function hasCompletedJobRun(
  runs: EventEmailJobRun[],
  phase: EventEmailPhase,
  asOfDateKey: string,
): boolean {
  return runs.some(
    (run) =>
      run.phase === phase &&
      run.asOfDateKey === asOfDateKey &&
      (run.status === "ran" ||
        run.status === "skipped" ||
        run.status === "cancelled"),
  );
}

/** Next IST firing datetime ISO for a daily HH:mm schedule. */
export function nextFiringIso(
  timeIst: string,
  now = new Date(),
): { asOfDateKey: string; atIso: string; label: string } {
  const clock = istClock(now);
  const scheduled = timeIstToMinutes(timeIst);
  let asOfDateKey = clock.dateKey;
  if (clock.minutesFromMidnight >= scheduled) {
    asOfDateKey = shiftDateKey(clock.dateKey, 1);
  }

  const [y, m, d] = asOfDateKey.split("-").map(Number);
  const [hh, mm] = normalizeTimeIst(timeIst, "00:00").split(":").map(Number);
  const atIso = new Date(
    Date.parse(
      `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+05:30`,
    ),
  ).toISOString();

  const label = new Date(atIso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

  return { asOfDateKey, atIso, label };
}

export type EventEmailJobCard = {
  phase: EventEmailPhase;
  label: string;
  enabled: boolean;
  timeIst: string;
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

export type EventEmailJobsDashboard = {
  config: EventEmailJobConfig;
  jobs: EventEmailJobCard[];
  cancels: EventEmailJobCancel[];
  runs: EventEmailJobRun[];
  nowIst: string;
};

export async function getEventEmailJobsDashboard(
  now = new Date(),
): Promise<EventEmailJobsDashboard> {
  const config = normalizeEventEmailJobConfig(await getEventEmailJobConfig());
  const cancels = await getEventEmailJobCancels();
  const runs = await listEventEmailJobRuns();
  const clock = istClock(now);

  const next = nextFiringIso(config.timeIst, now);
  const todayDateKey = next.asOfDateKey;
  const tomorrowDateKey = shiftDateKey(next.asOfDateKey, 1);
  const cancel = findCancel(cancels, "digest", next.asOfDateKey);
  const alreadyDone = hasCompletedJobRun(runs, "digest", next.asOfDateKey);

  let estimatedRecipients = 0;
  let eventNames: string[] = [];
  try {
    const plan = await planEventEmails({
      asOfDateKey: next.asOfDateKey,
      dryRun: true,
    });
    estimatedRecipients = plan.plans.reduce(
      (sum, row) => sum + row.recipients.length,
      0,
    );
    eventNames = [
      ...new Set(
        plan.plans.flatMap((row) => [
          ...row.todayEvents.map((e) => e.name),
          ...row.tomorrowEvents.map((e) => e.name),
        ]),
      ),
    ];
  } catch {
    // planning can fail without DB — still show schedule
  }

  return {
    config,
    jobs: [
      {
        phase: "digest",
        label: phaseLabel("digest"),
        enabled: config.enabled,
        timeIst: config.timeIst,
        next: {
          asOfDateKey: next.asOfDateKey,
          todayDateKey,
          tomorrowDateKey,
          atIso: next.atIso,
          label: next.label,
          cancelled: Boolean(cancel),
          cancelReason: cancel?.reason,
          alreadyDone,
          estimatedRecipients,
          eventNames,
        },
      },
    ],
    cancels,
    runs,
    nowIst: `${clock.dateKey} ${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")} IST`,
  };
}

async function persistRunFromResult(input: {
  result: EventEmailRunResult;
  trigger: "cron" | "manual";
  status?: EventEmailJobRun["status"];
  note?: string;
  startedAt: string;
}) {
  const { result } = input;
  const recipientCount = result.plans.reduce(
    (sum, plan) => sum + plan.recipientCount,
    0,
  );
  let status: EventEmailJobRun["status"] =
    input.status ||
    (result.dryRun
      ? "dry_run"
      : result.failed > 0 && result.sent === 0
        ? "failed"
        : result.sent === 0 && recipientCount === 0
          ? "skipped"
          : "ran");

  if (!input.status && !result.dryRun && result.sent === 0 && recipientCount > 0) {
    status = result.failed > 0 ? "failed" : "skipped";
  }

  return recordEventEmailJobRun({
    phase: "digest",
    asOfDateKey: result.asOfDateKey,
    targetDateKey: result.targetDateKey,
    status,
    trigger: input.trigger,
    sent: result.sent,
    skipped: result.skipped,
    failed: result.failed,
    recipientCount,
    note: input.note || result.errors.slice(0, 3).join(" · ") || undefined,
    startedAt: input.startedAt,
    finishedAt: new Date().toISOString(),
  });
}

export async function executeEventEmailJob(input: {
  phase?: EventEmailPhase;
  dryRun?: boolean;
  force?: boolean;
  asOfDateKey?: string;
  trigger: "cron" | "manual";
  respectGuards?: boolean;
}): Promise<{
  ok: boolean;
  blocked?: string;
  result?: EventEmailRunResult;
  run?: EventEmailJobRun;
}> {
  const startedAt = new Date().toISOString();
  const config = normalizeEventEmailJobConfig(await getEventEmailJobConfig());
  const asOfDateKey = input.asOfDateKey || istDateKey();
  const respect = input.respectGuards !== false && input.trigger === "cron";

  if (respect) {
    if (!config.enabled) {
      return { ok: false, blocked: "Job disabled in dashboard" };
    }

    const cancels = await getEventEmailJobCancels();
    const cancel = findCancel(cancels, "digest", asOfDateKey);
    if (cancel) {
      const run = await recordEventEmailJobRun({
        phase: "digest",
        asOfDateKey,
        targetDateKey: shiftDateKey(asOfDateKey, 1),
        status: "cancelled",
        trigger: input.trigger,
        sent: 0,
        skipped: 0,
        failed: 0,
        recipientCount: 0,
        note: cancel.reason || "Cancelled from dashboard",
        startedAt,
        finishedAt: new Date().toISOString(),
      });
      return { ok: false, blocked: "Cancelled from dashboard", run };
    }

    const runs = await listEventEmailJobRuns();
    if (hasCompletedJobRun(runs, "digest", asOfDateKey)) {
      return { ok: false, blocked: "Already ran for this IST day" };
    }
  }

  const result = await runEventEmails({
    dryRun: Boolean(input.dryRun),
    force: Boolean(input.force),
    asOfDateKey,
  });

  const run = await persistRunFromResult({
    result,
    trigger: input.trigger,
    startedAt,
  });

  return { ok: true, result, run };
}

/**
 * Daily tick (Vercel Hobby: one cron/day).
 * Invocation itself means the digest is due — schedule lives in vercel.json
 * (`30 15 * * *` ≈ 21:00 IST). Dashboard timeIst should match that slot.
 */
export async function tickEventEmailJobs(now = new Date()): Promise<{
  checkedAt: string;
  actions: Array<{
    phase: EventEmailPhase;
    due: boolean;
    blocked?: string;
    result?: EventEmailRunResult;
  }>;
}> {
  const clock = istClock(now);

  const executed = await executeEventEmailJob({
    trigger: "cron",
    asOfDateKey: clock.dateKey,
    respectGuards: true,
  });

  return {
    checkedAt: `${clock.dateKey} ${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")} IST`,
    actions: [
      {
        phase: "digest",
        due: true,
        blocked: executed.blocked,
        result: executed.result,
      },
    ],
  };
}

export async function saveEventEmailJobSchedule(input: {
  enabled?: boolean;
  timeIst?: string;
}) {
  const current = normalizeEventEmailJobConfig(await getEventEmailJobConfig());
  const next = normalizeEventEmailJobConfig({
    enabled:
      input.enabled === undefined ? current.enabled : Boolean(input.enabled),
    timeIst: input.timeIst ?? current.timeIst,
    updatedAt: new Date().toISOString(),
  });
  await updateEventEmailJobConfig(next);
  return next;
}

export async function cancelNextEventEmailJob(input: {
  phase?: EventEmailPhase;
  asOfDateKey?: string;
  reason?: string;
}) {
  const config = normalizeEventEmailJobConfig(await getEventEmailJobConfig());
  const asOfDateKey =
    input.asOfDateKey || nextFiringIso(config.timeIst).asOfDateKey;
  return setEventEmailJobCancel({
    phase: "digest",
    asOfDateKey,
    reason: input.reason?.trim() || undefined,
  });
}

export async function uncancelEventEmailJob(input: {
  phase?: EventEmailPhase;
  asOfDateKey: string;
}) {
  return removeEventEmailJobCancel("digest", input.asOfDateKey);
}
