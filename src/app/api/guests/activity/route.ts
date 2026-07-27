import { NextResponse } from "next/server";
import { z } from "zod";
import { isGuestAuthFailure, requireGuestAuth } from "@/lib/require-guest";
import { recordGuestLogin } from "@/lib/store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum([
    "login",
    "gallery_view",
    "gallery_download",
    "rsvp",
    "stay",
    "photos",
    "query",
    "message",
  ]),
  detail: z.string().trim().max(200).optional(),
});

export async function POST(request: Request) {
  const guest = await requireGuestAuth(request);
  if (isGuestAuthFailure(guest)) return guest;

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid activity" }, { status: 400 });
  }

  try {
    await recordGuestLogin(guest, parsed.data.action, parsed.data.detail);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/guests/activity failed", error);
    return NextResponse.json(
      { error: "Could not record activity" },
      { status: 500 },
    );
  }
}
