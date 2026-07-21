import { NextResponse } from "next/server";
import { z } from "zod";
import { createAndSendEmailOtp } from "@/lib/email-otp";
import { isGuestAuthFailure, requireGuestAuth } from "@/lib/require-guest";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

export async function POST(request: Request) {
  try {
    const guest = await requireGuestAuth(request);
    if (isGuestAuthFailure(guest)) return guest;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid email" },
        { status: 400 },
      );
    }

    // Guests may only request OTPs for their own Google email (or any email if Google has none)
    const target = parsed.data.email.trim().toLowerCase();
    if (guest.email && guest.email.toLowerCase() !== target) {
      return NextResponse.json(
        { error: "Use the same email as your Google account" },
        { status: 403 },
      );
    }

    const result = await createAndSendEmailOtp(parsed.data.email);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, email: result.email });
  } catch (error) {
    console.error("POST /api/auth/email/send failed", error);
    return NextResponse.json(
      { error: "Could not send verification code" },
      { status: 500 },
    );
  }
}
