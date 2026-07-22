import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMaster } from "@/lib/auth";
import { sendTeamUpdateEmail } from "@/lib/email";
import { deleteAdmin, updateAdmin } from "@/lib/store";
import type { AdminPermission } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const permissionEnum = z.enum([
  "rsvp",
  "stay",
  "gallery_upload",
  "gallery_review",
  "faces",
  "events",
  "guests",
  "team",
]);

const patchSchema = z.object({
  name: z.string().trim().min(2).optional(),
  email: z.string().trim().email("A valid email is required").optional(),
  pin: z.string().trim().min(4).optional(),
  permissions: z.array(permissionEnum).min(1).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    if (!(await requireMaster())) {
      return NextResponse.json({ error: "Master only" }, { status: 403 });
    }

    const { id } = await params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid details" },
        { status: 400 },
      );
    }

    const admin = await updateAdmin(id, {
      name: parsed.data.name,
      email: parsed.data.email,
      pin: parsed.data.pin,
      permissions: parsed.data.permissions as AdminPermission[] | undefined,
      active: parsed.data.active,
    });

    if (!admin) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    let emailSent = false;
    let emailError: string | undefined;
    if (admin.email) {
      const mailed = await sendTeamUpdateEmail({
        name: admin.name,
        email: admin.email,
        permissions: admin.permissions,
        active: admin.active,
        newPin: parsed.data.pin,
      });
      emailSent = mailed.ok;
      if (!mailed.ok) emailError = mailed.error;
    } else {
      emailError = "Member has no email on file";
    }

    return NextResponse.json({ admin, emailSent, emailError });
  } catch (error) {
    console.error("PATCH /api/admins/[id] failed", error);
    const message =
      error instanceof Error ? error.message : "Could not update member";
    const status = /already used/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }
  const { id } = await params;
  const ok = await deleteAdmin(id);
  if (!ok) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
