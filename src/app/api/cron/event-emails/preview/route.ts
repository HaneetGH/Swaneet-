import { NextRequest, NextResponse } from "next/server";
import { runEventEmails } from "@/lib/event-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

/** 8:00 PM IST — tomorrow’s events for attending guests */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runEventEmails({ phase: "preview" });
  return NextResponse.json(result);
}
