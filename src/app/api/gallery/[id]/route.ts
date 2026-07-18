import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { readStore, writeStore } from "@/lib/store";
import { deleteUploadedImage } from "@/lib/uploads";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
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
