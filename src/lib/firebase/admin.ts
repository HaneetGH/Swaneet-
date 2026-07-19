import { createRemoteJWKSet, jwtVerify } from "jose";

export type VerifiedGuest = {
  uid: string;
  email?: string;
  phone?: string;
  name?: string;
};

export function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID ||
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  );
}

function getProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    ""
  );
}

const jwks = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<VerifiedGuest> {
  const projectId = getProjectId();
  if (!projectId) {
    throw new Error("Firebase project id is not configured");
  }

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  const uid = typeof payload.user_id === "string" ? payload.user_id : payload.sub;
  if (!uid || typeof uid !== "string") {
    throw new Error("Invalid Firebase token");
  }

  return {
    uid,
    email: typeof payload.email === "string" ? payload.email : undefined,
    phone:
      typeof payload.phone_number === "string"
        ? payload.phone_number
        : undefined,
    name: typeof payload.name === "string" ? payload.name : undefined,
  };
}

export async function verifyBearerToken(
  request: Request,
): Promise<VerifiedGuest | null> {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    return await verifyFirebaseIdToken(token);
  } catch {
    return null;
  }
}
