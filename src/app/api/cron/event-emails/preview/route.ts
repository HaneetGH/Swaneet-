import { NextRequest, NextResponse } from "next/server";
import { executeEventEmailJob } from "@/lib/event-email-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

/** Legacy path — now runs the single evening digest. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const executed = await executeEventEmailJob({
    trigger: "cron",
    respectGuards: true,
  });
  return NextResponse.json(executed);
}
