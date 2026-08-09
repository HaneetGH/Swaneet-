import { NextRequest, NextResponse } from "next/server";
import { requireMaster } from "@/lib/auth";
import {
  collectAnnouncementRecipients,
  runAnnouncementEmail,
  type AnnouncementWave,
} from "@/lib/announcement-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Master: preview unique RSVP + stay + wish + login recipients */
export async function GET() {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }
  const recipients = await collectAnnouncementRecipients();
  return NextResponse.json({
    recipientCount: recipients.length,
    recipients: recipients.map((row) => ({
      email: row.email,
      name: row.name,
      sources: row.sources,
      site: row.site,
    })),
  });
}

/**
 * Master: dry-run or send arrival announcement.
 * body: { wave: "today" | "tomorrow" | "apology", dryRun?: boolean, force?: boolean }
 */
export async function POST(request: NextRequest) {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    wave?: string;
    dryRun?: boolean;
    force?: boolean;
  };

  const wave = (
    body.wave === "tomorrow"
      ? "tomorrow"
      : body.wave === "apology"
        ? "apology"
        : "today"
  ) as AnnouncementWave;
  const dryRun = body.dryRun === undefined ? true : Boolean(body.dryRun);

  const result = await runAnnouncementEmail({
    wave,
    dryRun,
    force: Boolean(body.force),
  });

  return NextResponse.json(result);
}
