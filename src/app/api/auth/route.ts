import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  encodeAdminCookie,
  loginWithPin,
} from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { pin?: string };
  if (!body.pin) {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 });
  }

  const session = await loginWithPin(body.pin);
  if (!session) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    session: {
      kind: session.kind,
      name: session.name,
      permissions: session.permissions,
    },
  });
  response.cookies.set(ADMIN_COOKIE, encodeAdminCookie(session), {
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

export async function GET() {
  const { getAdminSession } = await import("@/lib/auth");
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    session: {
      kind: session.kind,
      name: session.name,
      permissions: session.permissions,
    },
  });
}
