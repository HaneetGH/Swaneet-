import { NextRequest, NextResponse } from "next/server";
import { requireMaster } from "@/lib/auth";
import {
  cancelNextEventEmailJob,
  executeEventEmailJob,
  getEventEmailJobsDashboard,
  saveEventEmailJobSchedule,
  uncancelEventEmailJob,
} from "@/lib/event-email-jobs";
import type { EventEmailPhase } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parsePhase(raw: unknown): EventEmailPhase | null {
  if (raw === "preview" || raw === "thanks") return raw;
  return null;
}

/** Master dashboard: schedule, next runs, history */
export async function GET() {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }
  const dashboard = await getEventEmailJobsDashboard();
  return NextResponse.json(dashboard);
}

/**
 * Master actions:
 * - action=update — enable/times
 * - action=cancel / uncancel — next (or specific) firing
 * - action=run — dry-run or send now (records in job history)
 */
export async function POST(request: NextRequest) {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    phase?: string;
    asOfDateKey?: string;
    reason?: string;
    dryRun?: boolean;
    force?: boolean;
    previewEnabled?: boolean;
    thanksEnabled?: boolean;
    previewTimeIst?: string;
    thanksTimeIst?: string;
  };

  const action = body.action || "update";

  if (action === "update") {
    const config = await saveEventEmailJobSchedule({
      previewEnabled: body.previewEnabled,
      thanksEnabled: body.thanksEnabled,
      previewTimeIst: body.previewTimeIst,
      thanksTimeIst: body.thanksTimeIst,
    });
    const dashboard = await getEventEmailJobsDashboard();
    return NextResponse.json({ config, dashboard });
  }

  if (action === "cancel") {
    const phase = parsePhase(body.phase);
    if (!phase) {
      return NextResponse.json(
        { error: "phase must be preview or thanks" },
        { status: 400 },
      );
    }
    const cancel = await cancelNextEventEmailJob({
      phase,
      asOfDateKey: body.asOfDateKey?.trim() || undefined,
      reason: body.reason,
    });
    const dashboard = await getEventEmailJobsDashboard();
    return NextResponse.json({ cancel, dashboard });
  }

  if (action === "uncancel") {
    const phase = parsePhase(body.phase);
    const asOfDateKey = body.asOfDateKey?.trim();
    if (!phase || !asOfDateKey) {
      return NextResponse.json(
        { error: "phase and asOfDateKey are required" },
        { status: 400 },
      );
    }
    await uncancelEventEmailJob({ phase, asOfDateKey });
    const dashboard = await getEventEmailJobsDashboard();
    return NextResponse.json({ dashboard });
  }

  if (action === "run") {
    const phase = parsePhase(body.phase);
    if (!phase) {
      return NextResponse.json(
        { error: "phase must be preview or thanks" },
        { status: 400 },
      );
    }
    const dryRun = body.dryRun === undefined ? true : Boolean(body.dryRun);
    const executed = await executeEventEmailJob({
      phase,
      dryRun,
      force: Boolean(body.force),
      asOfDateKey: body.asOfDateKey?.trim() || undefined,
      trigger: "manual",
      respectGuards: false,
    });
    const dashboard = await getEventEmailJobsDashboard();
    return NextResponse.json({ ...executed, dashboard });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
