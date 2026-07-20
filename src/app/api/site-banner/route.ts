import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import {
  deleteUploadedImage,
  saveUploadedImage,
} from "@/lib/uploads";
import { getRsvpBanner, setRsvpBannerImage } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Public: homepage RSVP banner image */
export async function GET() {
  try {
    const banner = await getRsvpBanner();
    return NextResponse.json({ banner });
  } catch (error) {
    console.error("GET /api/site-banner failed", error);
    return NextResponse.json({ banner: {} });
  }
}

/** Master: upload or clear RSVP banner image */
export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session || session.kind !== "master") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose an image to upload" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Banner must be an image file" },
        { status: 400 },
      );
    }

    const previous = await getRsvpBanner();
    const imageUrl = await saveUploadedImage(file);
    const banner = await setRsvpBannerImage(imageUrl);

    if (previous.imageUrl && previous.imageUrl !== imageUrl) {
      await deleteUploadedImage(previous.imageUrl).catch(() => undefined);
    }

    return NextResponse.json({ banner });
  } catch (error) {
    console.error("POST /api/site-banner failed", error);
    const message =
      error instanceof Error ? error.message : "Could not upload banner";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getAdminSession();
    if (!session || session.kind !== "master") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const previous = await getRsvpBanner();
    const banner = await setRsvpBannerImage(undefined);
    if (previous.imageUrl) {
      await deleteUploadedImage(previous.imageUrl).catch(() => undefined);
    }
    return NextResponse.json({ banner });
  } catch (error) {
    console.error("DELETE /api/site-banner failed", error);
    const message =
      error instanceof Error ? error.message : "Could not remove banner";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
