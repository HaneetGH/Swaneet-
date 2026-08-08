import { NextRequest, NextResponse } from "next/server";
import { requireMaster } from "@/lib/auth";
import { runEventEmails } from "@/lib/event-emails";
import type { EventEmailPhase } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parsePhase(raw: unknown): EventEmailPhase | null {
  if (raw === "preview" || raw === "thanks") return raw;
  return null;
}

/** Master: dry-run (default) or send night-before / day-end event emails */
export async function POST(request: NextRequest) {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    phase?: string;
    dryRun?: boolean;
    force?: boolean;
    asOf?: string;
  };

  const phase = parsePhase(body.phase);
  if (!phase) {
    return NextResponse.json(
      { error: "phase must be preview or thanks" },
      { status: 400 },
    );
  }

  const dryRun = body.dryRun === undefined ? true : Boolean(body.dryRun);

  const result = await runEventEmails({
    phase,
    dryRun,
    force: Boolean(body.force),
    asOfDateKey: body.asOf?.trim() || undefined,
  });

  return NextResponse.json(result);
}
