import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { sendGuestPhotoRejectionEmail } from "@/lib/email";
import { readStore, writeStore } from "@/lib/store";
import { deleteUploadedImage } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const schema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(50),
  action: z.enum(["approve", "reject", "assign"]),
  eventId: z.string().optional().default(""),
});

export async function POST(request: Request) {
  try {
    if (!(await requirePermission("gallery_review"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 },
      );
    }

    const { ids, action, eventId } = parsed.data;
    const store = await readStore();
    const idSet = new Set(ids);

    if (
      (action === "approve" || action === "assign") &&
      eventId &&
      !store.events.some((event) => event.id === eventId)
    ) {
      return NextResponse.json(
        { error: "Selected event was not found" },
        { status: 400 },
      );
    }

    const targets = store.gallery.filter((item) => idSet.has(item.id));
    if (!targets.length) {
      return NextResponse.json(
        { error: "No matching photos found" },
        { status: 404 },
      );
    }

    if (action === "reject") {
      const remaining = store.gallery.filter((item) => !idSet.has(item.id));
      store.gallery = remaining;
      await writeStore(store);

      let emailed = 0;
      let emailFailed = 0;
      for (const image of targets) {
        await deleteUploadedImage(image.src);
        if (image.uploadedByEmail) {
          const mailed = await sendGuestPhotoRejectionEmail(image);
          if (mailed.ok) emailed += 1;
          else emailFailed += 1;
        } else {
          emailFailed += 1;
        }
      }

      return NextResponse.json({
        ok: true,
        action,
        count: targets.length,
        emailed,
        emailFailed,
      });
    }

    store.gallery = store.gallery.map((item) => {
      if (!idSet.has(item.id)) return item;
      if (action === "assign") {
        return { ...item, eventId: eventId || item.eventId };
      }
      return {
        ...item,
        status: "approved" as const,
        eventId: eventId !== undefined && eventId !== "" ? eventId : item.eventId,
      };
    });
    await writeStore(store);

    const updated = store.gallery.filter((item) => idSet.has(item.id));

    // Face-find: index newly approved images when the feature is on (best-effort)
    if (action === "approve") {
      try {
        const { isFeatureEnabled } = await import("@/lib/feature-flags");
        const { getFeatureFlags } = await import("@/lib/store");
        const { indexApprovedGalleryImage } = await import("@/lib/face-store");
        const { isRekognitionConfigured } = await import("@/lib/rekognition");
        const flags = await getFeatureFlags();
        const faceOn =
          isFeatureEnabled(flags, "main", "face_find") ||
          isFeatureEnabled(flags, "mehfil", "face_find") ||
          isFeatureEnabled(flags, "laavan", "face_find");
        if (faceOn && isRekognitionConfigured()) {
          for (const image of updated) {
            if (image.status === "approved" && image.kind === "image") {
              await indexApprovedGalleryImage(image).catch((error) =>
                console.error("face index on approve failed", image.id, error),
              );
            }
          }
        }
      } catch (error) {
        console.error("face index hook failed", error);
      }
    }

    return NextResponse.json({
      ok: true,
      action,
      count: updated.length,
      images: updated,
    });
  } catch (error) {
    console.error("POST /api/gallery/moderate failed", error);
    return NextResponse.json(
      { error: "Could not update photos" },
      { status: 500 },
    );
  }
}
