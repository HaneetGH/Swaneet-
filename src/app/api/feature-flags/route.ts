import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMaster } from "@/lib/auth";
import { normalizeFeatureFlags } from "@/lib/feature-flags";
import { getFeatureFlags, updateFeatureFlags } from "@/lib/store";

export const dynamic = "force-dynamic";

const siteSchema = z.object({
  rsvp: z.boolean(),
  accommodation: z.boolean(),
  gallery: z.boolean(),
  guest_photos: z.boolean(),
  stay_banner: z.boolean(),
  face_find: z.boolean(),
  guest_messages: z.boolean(),
});

const flagsSchema = z.object({
  main: siteSchema,
  mehfil: siteSchema,
  laavan: siteSchema,
});

export async function GET() {
  try {
    const flags = await getFeatureFlags();
    return NextResponse.json(
      { flags },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error("GET /api/feature-flags failed", error);
    return NextResponse.json(
      { error: "Could not load feature flags" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await requireMaster())) {
      return NextResponse.json({ error: "Master only" }, { status: 403 });
    }

    const parsed = flagsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid feature flags" },
        { status: 400 },
      );
    }

    const flags = await updateFeatureFlags(
      normalizeFeatureFlags(parsed.data),
    );
    return NextResponse.json({ flags });
  } catch (error) {
    console.error("PUT /api/feature-flags failed", error);
    return NextResponse.json(
      { error: "Could not save feature flags" },
      { status: 500 },
    );
  }
}
