import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

export function isFirebaseAdminConfigured() {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY,
  );
}

function getAdminApp(): App {
  if (!isFirebaseAdminConfigured()) {
    throw new Error("Firebase Admin is not configured");
  }

  if (getApps().length) return getApps()[0]!;

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export type VerifiedGuest = {
  uid: string;
  email?: string;
  phone?: string;
  name?: string;
};

export async function verifyFirebaseIdToken(
  idToken: string,
): Promise<VerifiedGuest> {
  const decoded = await getAdminAuth().verifyIdToken(idToken);
  return {
    uid: decoded.uid,
    email: decoded.email,
    phone: decoded.phone_number,
    name: typeof decoded.name === "string" ? decoded.name : undefined,
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
