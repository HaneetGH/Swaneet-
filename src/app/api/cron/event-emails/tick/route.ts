import { NextRequest, NextResponse } from "next/server";
import { tickEventEmailJobs } from "@/lib/event-email-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

/**
 * Hourly tick — sends one evening digest (today + tomorrow + links)
 * when the IST clock is inside the admin-configured schedule window.
 */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await tickEventEmailJobs();
  return NextResponse.json(result);
}
