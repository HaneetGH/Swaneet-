import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { sendGuestPhotoRejectionEmail } from "@/lib/email";
import { readStore, writeStore } from "@/lib/store";
import { deleteUploadedImage } from "@/lib/uploads";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  status: z.enum(["approved", "rejected"]).optional(),
  eventId: z.string().optional(),
}).refine((data) => data.status != null || data.eventId !== undefined, {
  message: "Provide status and/or eventId",
});

export async function PATCH(request: Request, { params }: Params) {
  if (!(await requirePermission("gallery"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid update" },
      { status: 400 },
    );
  }

  const store = await readStore();
  const index = store.gallery.findIndex((item) => item.id === id);
  if (index < 0) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  if (parsed.data.status === "rejected") {
    const image = store.gallery[index];
    store.gallery = store.gallery.filter((item) => item.id !== id);
    await writeStore(store);
    await deleteUploadedImage(image.src);

    let emailSent = false;
    let emailError: string | undefined;
    if (image.uploadedByEmail) {
      const mailed = await sendGuestPhotoRejectionEmail(image);
      emailSent = mailed.ok;
      if (!mailed.ok) emailError = mailed.error;
    } else {
      emailError = "No guest email on this upload";
    }

    return NextResponse.json({
      ok: true,
      deleted: true,
      emailSent,
      emailError,
    });
  }

  const image = store.gallery[index];
  store.gallery[index] = {
    ...image,
    ...(parsed.data.status === "approved" ? { status: "approved" as const } : {}),
    eventId:
      parsed.data.eventId !== undefined
        ? parsed.data.eventId
        : image.eventId,
  };
  await writeStore(store);

  return NextResponse.json({ image: store.gallery[index] });
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await requirePermission("gallery"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const store = await readStore();
  const image = store.gallery.find((item) => item.id === id);
  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  store.gallery = store.gallery.filter((item) => item.id !== id);
  await writeStore(store);
  await deleteUploadedImage(image.src);

  return NextResponse.json({ ok: true });
}
