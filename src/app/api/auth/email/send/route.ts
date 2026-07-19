import { NextResponse } from "next/server";
import { z } from "zod";
import { createAndSendEmailOtp } from "@/lib/email-otp";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid email" },
        { status: 400 },
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
