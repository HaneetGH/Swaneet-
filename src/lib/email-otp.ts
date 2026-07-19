import { createHash, randomInt, timingSafeEqual } from "crypto";
import { isEmailConfigured } from "@/lib/email";
import { readStore, writeStore } from "@/lib/store";

const OTP_TTL_MS = 10 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function createAndSendEmailOtp(email: string) {
  if (!isEmailConfigured()) {
    return {
      ok: false as const,
      error:
        "Email is not configured. Add RESEND_API_KEY and EMAIL_FROM in Vercel.",
    };
  }

  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { ok: false as const, error: "Enter a valid email address" };
  }

  const code = String(randomInt(100000, 999999));
  const store = await readStore();
  const otps = { ...(store.emailOtps || {}) };
  otps[normalized] = {
    hash: hashCode(code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  };
  store.emailOtps = otps;
  await writeStore(store);

  const apiKey = process.env.RESEND_API_KEY!;
  const from = process.env.EMAIL_FROM!;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [normalized],
      subject: "Your #Swaneet email verification code",
      text: `Your verification code is ${code}. It expires in 10 minutes.\n\n#Swaneet`,
      html: `
        <div style="font-family: Georgia, serif; color: #1a1208; line-height: 1.6;">
          <p style="letter-spacing: 0.2em; text-transform: uppercase; font-size: 11px; color: #b8922a;">#Swaneet</p>
          <h1 style="font-weight: 400;">Verify your email</h1>
          <p>Your verification code is:</p>
          <p style="font-size: 32px; letter-spacing: 0.2em;"><strong>${code}</strong></p>
          <p>This code expires in 10 minutes.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    return {
      ok: false as const,
      error: body.message || `Could not send verification email (${response.status})`,
    };
  }

  return { ok: true as const, email: normalized };
}

export async function verifyEmailOtp(email: string, code: string) {
  const normalized = normalizeEmail(email);
  const store = await readStore();
  const entry = store.emailOtps?.[normalized];
  if (!entry) {
    return { ok: false as const, error: "No code found. Please send a new one." };
  }
  if (new Date(entry.expiresAt).getTime() < Date.now()) {
    return { ok: false as const, error: "Code expired. Please send a new one." };
  }

  const expected = Buffer.from(entry.hash, "hex");
  const actual = Buffer.from(hashCode(code.trim()), "hex");
  if (
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual)
  ) {
    return { ok: false as const, error: "Incorrect code. Please try again." };
  }

  const otps = { ...(store.emailOtps || {}) };
  delete otps[normalized];
  store.emailOtps = otps;
  await writeStore(store);

  return { ok: true as const, email: normalized };
}
