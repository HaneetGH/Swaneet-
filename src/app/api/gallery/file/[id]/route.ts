import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  getAdminSession,
} from "@/lib/auth";
import {
  isFeatureEnabled,
} from "@/lib/feature-flags";
import { verifyBearerToken } from "@/lib/firebase/admin";
import { verifyGalleryAccessToken } from "@/lib/gallery-access";
import { getFeatureFlags, getGalleryImageById } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function guessContentType(src: string, kind?: string) {
  const lower = src.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.includes(".mp4")) return "video/mp4";
  if (lower.includes(".webm")) return "video/webm";
  if (lower.includes(".mov")) return "video/quicktime";
  if (kind === "video") return "video/mp4";
  return "image/jpeg";
}

/**
 * Authenticated media proxy — browsers never need the raw Blob URL.
 * Accepts: admin session cookie, Firebase Bearer, or short-lived ?access= token.
 */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing image id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get("access");
    const access = verifyGalleryAccessToken(accessToken);
    const session = await getAdminSession();
    const guest = await verifyBearerToken(request);

    const isAdmin = Boolean(session);

    if (!isAdmin && !guest && !access) {
      return NextResponse.json(
        { error: "Please sign in to view this photo" },
        { status: 401 },
      );
    }

    // If both bearer and access present, they should match when possible
    if (!isAdmin && guest && access && guest.uid !== access.uid) {
      return NextResponse.json({ error: "Invalid access" }, { status: 403 });
    }

    const image = await getGalleryImageById(id);
    if (!image) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const emailKey = (value?: string) => value?.trim().toLowerCase() || "";
    const isOwner =
      (Boolean(guest) &&
        (image.uploadedByUid === guest?.uid ||
          (Boolean(guest?.email) &&
            emailKey(image.uploadedByEmail) === emailKey(guest?.email)))) ||
      (Boolean(access?.uid) && image.uploadedByUid === access?.uid);

    // Guests only see approved media, unless it is their own upload
    if (image.status !== "approved" && !isAdmin && !isOwner) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Public gallery browsing requires gallery feature; own uploads always ok
    if (!isAdmin && !isOwner) {
      const site = access?.site || "main";
      const flags = await getFeatureFlags();
      if (!isFeatureEnabled(flags, site, "gallery")) {
        return NextResponse.json(
          { error: "Gallery is turned off for this invite" },
          { status: 403 },
        );
      }
    }

    const contentType = guessContentType(image.src, image.kind);
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    };

    // Local public upload fallback
    if (image.src.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", image.src);
      const data = await fs.readFile(filePath);
      return new NextResponse(data, { headers });
    }

    // Remote Blob / CDN — fetch server-side so the browser never needs the raw URL
    const upstream = await fetch(image.src, { cache: "force-cache" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "Could not load media" },
        { status: 502 },
      );
    }

    return new NextResponse(upstream.body, {
      headers: {
        ...headers,
        "Content-Type": upstream.headers.get("content-type") || contentType,
      },
    });
  } catch (error) {
    console.error("GET /api/gallery/file failed", error);
    return NextResponse.json(
      { error: "Could not load media" },
      { status: 500 },
    );
  }
}
