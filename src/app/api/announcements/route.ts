import { NextRequest, NextResponse } from "next/server";
import { requireMaster } from "@/lib/auth";
import {
  ANNOUNCEMENT_TEST_EMAIL,
  collectAnnouncementRecipients,
  hasMainAnnouncementTest,
  runAnnouncementEmail,
  sendMainAnnouncementTest,
  type AnnouncementWave,
} from "@/lib/announcement-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Master: preview unique RSVP + stay + wish + login recipients */
export async function GET() {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }
  const [recipients, apologyTest, todayTest, tomorrowTest] = await Promise.all([
    collectAnnouncementRecipients(),
    hasMainAnnouncementTest("apology"),
    hasMainAnnouncementTest("today"),
    hasMainAnnouncementTest("tomorrow"),
  ]);
  return NextResponse.json({
    testEmail: ANNOUNCEMENT_TEST_EMAIL,
    recipientCount: recipients.length,
    mainTest: {
      apology: apologyTest,
      today: todayTest,
      tomorrow: tomorrowTest,
    },
    recipients: recipients.map((row) => ({
      email: row.email,
      name: row.name,
      sources: row.sources,
      site: row.site,
    })),
  });
}

/**
 * Master: dry-run, test-to-inbox, or send arrival announcement.
 * body: {
 *   wave: "today" | "tomorrow" | "apology",
 *   dryRun?: boolean,
 *   force?: boolean,
 *   mode?: "all" | "test"
 * }
 */
export async function POST(request: NextRequest) {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    wave?: string;
    dryRun?: boolean;
    force?: boolean;
    mode?: string;
  };

  const wave = (
    body.wave === "tomorrow"
      ? "tomorrow"
      : body.wave === "apology"
        ? "apology"
        : "today"
  ) as AnnouncementWave;

  if (body.mode === "test") {
    const result = await sendMainAnnouncementTest({ wave });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Test send failed", ...result },
        { status: 502 },
      );
    }
    return NextResponse.json(result);
  }

  const dryRun = body.dryRun === undefined ? true : Boolean(body.dryRun);

  const result = await runAnnouncementEmail({
    wave,
    dryRun,
    force: Boolean(body.force),
    requireMainTest: true,
  });

  if (result.blocked) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json(result);
}
