import { NextResponse } from "next/server";
import {
  isFirebaseAdminConfigured,
  verifyBearerToken,
  type VerifiedGuest,
} from "@/lib/firebase/admin";

/**
 * Guest APIs require a verified Firebase ID token from Google sign-in.
 * Knowing the URL is not enough — Authorization: Bearer <idToken> is required.
 */
export async function requireGuestAuth(
  request: Request,
): Promise<VerifiedGuest | NextResponse> {
  if (!isFirebaseAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          "Sign-in is not configured yet. Add Firebase env vars on Vercel.",
      },
      { status: 503 },
    );
  }

  const guest = await verifyBearerToken(request);
  if (!guest) {
    return NextResponse.json(
      {
        error: "Please sign in with Google first",
        code: "AUTH_REQUIRED",
      },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Bearer realm="swaneet-guest"',
          "Cache-Control": "no-store",
        },
      },
    );
  }

  return guest;
}

export function isGuestAuthFailure(
  value: VerifiedGuest | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
