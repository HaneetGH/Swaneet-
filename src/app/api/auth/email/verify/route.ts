import { NextResponse } from "next/server";
import { z } from "zod";
import { VERIFIED_EMAIL_COOKIE } from "@/lib/auth";
import { verifyEmailOtp } from "@/lib/email-otp";
import { isGuestAuthFailure, requireGuestAuth } from "@/lib/require-guest";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email(),
  code: z.string().trim().min(4).max(8),
});

export async function POST(request: Request) {
  try {
    const guest = await requireGuestAuth(request);
    if (isGuestAuthFailure(guest)) return guest;

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid details" },
        { status: 400 },
      );
    }

    const target = parsed.data.email.trim().toLowerCase();
    if (guest.email && guest.email.toLowerCase() !== target) {
      return NextResponse.json(
        { error: "Use the same email as your Google account" },
        { status: 403 },
      );
    }

    const result = await verifyEmailOtp(parsed.data.email, parsed.data.code);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true, email: result.email });
    response.cookies.set(VERIFIED_EMAIL_COOKIE, result.email, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error("POST /api/auth/email/verify failed", error);
    return NextResponse.json(
      { error: "Could not verify email" },
      { status: 500 },
    );
  }
}
