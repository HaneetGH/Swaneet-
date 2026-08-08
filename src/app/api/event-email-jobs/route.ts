import { NextRequest, NextResponse } from "next/server";
import { requireMaster } from "@/lib/auth";
import {
  cancelNextEventEmailJob,
  executeEventEmailJob,
  getEventEmailJobsDashboard,
  saveEventEmailJobSchedule,
  uncancelEventEmailJob,
} from "@/lib/event-email-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Master dashboard: schedule, next run, history */
export async function GET() {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }
  const dashboard = await getEventEmailJobsDashboard();
  return NextResponse.json(dashboard);
}

/**
 * Master actions:
 * - action=update — enable + time
 * - action=cancel / uncancel — next firing
 * - action=run — dry-run or send now
 */
export async function POST(request: NextRequest) {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    asOfDateKey?: string;
    reason?: string;
    dryRun?: boolean;
    force?: boolean;
    enabled?: boolean;
    timeIst?: string;
  };

  const action = body.action || "update";

  if (action === "update") {
    const config = await saveEventEmailJobSchedule({
      enabled: body.enabled,
      timeIst: body.timeIst,
    });
    const dashboard = await getEventEmailJobsDashboard();
    return NextResponse.json({ config, dashboard });
  }

  if (action === "cancel") {
    const cancel = await cancelNextEventEmailJob({
      asOfDateKey: body.asOfDateKey?.trim() || undefined,
      reason: body.reason,
    });
    const dashboard = await getEventEmailJobsDashboard();
    return NextResponse.json({ cancel, dashboard });
  }

  if (action === "uncancel") {
    const asOfDateKey = body.asOfDateKey?.trim();
    if (!asOfDateKey) {
      return NextResponse.json(
        { error: "asOfDateKey is required" },
        { status: 400 },
      );
    }
    await uncancelEventEmailJob({ asOfDateKey });
    const dashboard = await getEventEmailJobsDashboard();
    return NextResponse.json({ dashboard });
  }

  if (action === "run") {
    const dryRun = body.dryRun === undefined ? true : Boolean(body.dryRun);
    const executed = await executeEventEmailJob({
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
