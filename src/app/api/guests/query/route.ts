import { NextResponse } from "next/server";
import { z } from "zod";
import { notifyOwner } from "@/lib/email";
import { isGuestAuthFailure, requireGuestAuth } from "@/lib/require-guest";
import { recordGuestLogin } from "@/lib/store";

export const dynamic = "force-dynamic";

const schema = z.object({
  subject: z.string().trim().min(2).max(120),
  message: z.string().trim().min(8).max(2000),
  topic: z
    .enum(["booking", "rsvp", "photos", "other"])
    .optional()
    .default("other"),
});

/** Guest sends a short question to the family inbox. */
export async function POST(request: Request) {
  try {
    const guest = await requireGuestAuth(request);
    if (isGuestAuthFailure(guest)) return guest;

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid message" },
        { status: 400 },
      );
    }

    const { subject, message, topic } = parsed.data;
    const topicLabel =
      topic === "booking"
        ? "Stay / booking"
        : topic === "rsvp"
          ? "RSVP"
          : topic === "photos"
            ? "Photos"
            : "General";

    const notified = await notifyOwner({
      title: `Guest question: ${subject}`,
      summary: `${guest.name || guest.email || "A guest"} sent a question (${topicLabel}).`,
      details: [
        guest.name ? `Name: ${guest.name}` : "",
        guest.email ? `Email: ${guest.email}` : "",
        `Topic: ${topicLabel}`,
        `Subject: ${subject}`,
        "",
        message,
      ],
    });

    if (!notified.ok) {
      return NextResponse.json(
        { error: notified.error || "Could not send your question" },
        { status: 502 },
      );
    }

    await recordGuestLogin(guest, "query", subject.slice(0, 120)).catch(
      () => undefined,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/guests/query failed", error);
    return NextResponse.json(
      { error: "Could not send your question" },
      { status: 500 },
    );
  }
}
