import { NextRequest, NextResponse } from "next/server";
import { runEventEmails } from "@/lib/event-emails";
import type { EventEmailPhase } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  if (header === `Bearer ${secret}`) return true;
  const query = request.nextUrl.searchParams.get("secret");
  return Boolean(query && query === secret);
}

function parsePhase(raw: string | null): EventEmailPhase | null {
  if (raw === "preview" || raw === "thanks") return raw;
  return null;
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const phase = parsePhase(request.nextUrl.searchParams.get("phase"));
  if (!phase) {
    return NextResponse.json(
      { error: "Query phase=preview or phase=thanks is required" },
      { status: 400 },
    );
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const force = request.nextUrl.searchParams.get("force") === "1";
  const asOfDateKey =
    request.nextUrl.searchParams.get("asOf")?.trim() || undefined;

  const result = await runEventEmails({
    phase,
    dryRun,
    force,
    asOfDateKey,
  });

  return NextResponse.json(result);
}

/** Vercel Cron uses GET */
export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
