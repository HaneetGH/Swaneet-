import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { deleteRsvp } from "@/lib/store";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await deleteRsvp(id);
  if (!ok) {
    return NextResponse.json({ error: "RSVP not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
