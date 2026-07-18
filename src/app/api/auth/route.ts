import { NextResponse } from "next/server";
import { ADMIN_COOKIE, authCookieValue, getAdminPin } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { pin?: string };
  if (!body.pin || body.pin !== getAdminPin()) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, authCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
