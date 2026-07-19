import { NextResponse } from "next/server";
import {
  GUEST_COOKIE,
  authCookieValue,
  verifyGuestPin,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { pin?: string };
  if (!body.pin || !verifyGuestPin(body.pin)) {
    return NextResponse.json({ error: "Invalid guest code" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(GUEST_COOKIE, authCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(GUEST_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function GET() {
  const { canRequestAccommodation } = await import("@/lib/auth");
  const ok = await canRequestAccommodation();
  return NextResponse.json({ authenticated: ok });
}
