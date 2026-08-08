import { NextRequest, NextResponse } from "next/server";
import { requireMaster } from "@/lib/auth";
import { runEventEmails } from "@/lib/event-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Master: dry-run (default) or send the evening digest */
export async function POST(request: NextRequest) {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    dryRun?: boolean;
    force?: boolean;
    asOf?: string;
  };

  const dryRun = body.dryRun === undefined ? true : Boolean(body.dryRun);

  const result = await runEventEmails({
    dryRun,
    force: Boolean(body.force),
    asOfDateKey: body.asOf?.trim() || undefined,
  });

  return NextResponse.json(result);
}
