import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMaster } from "@/lib/auth";
import { sendTeamInviteEmail } from "@/lib/email";
import { createAdmin, listAdmins } from "@/lib/store";
import type { AdminPermission } from "@/lib/types";

export const dynamic = "force-dynamic";

const permissionEnum = z.enum([
  "rsvp",
  "stay",
  "gallery_upload",
  "gallery_review",
  "events",
  "guests",
  "team",
]);

const createSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  email: z.string().trim().email("A valid email is required"),
  pin: z.string().trim().min(4, "PIN must be at least 4 characters"),
  permissions: z.array(permissionEnum).min(1, "Pick at least one permission"),
});

export async function GET() {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }
  const admins = await listAdmins();
  return NextResponse.json({ admins });
}

export async function POST(request: Request) {
  try {
    if (!(await requireMaster())) {
      return NextResponse.json({ error: "Master only" }, { status: 403 });
    }

    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid details" },
        { status: 400 },
      );
    }

    const permissions = parsed.data.permissions as AdminPermission[];
    const admin = await createAdmin({
      name: parsed.data.name,
      email: parsed.data.email,
      pin: parsed.data.pin,
      permissions,
    });

    const mailed = await sendTeamInviteEmail({
      name: parsed.data.name,
      email: parsed.data.email,
      pin: parsed.data.pin,
      permissions: admin.permissions,
    });

    return NextResponse.json(
      {
        admin,
        emailSent: mailed.ok,
        emailError: mailed.ok ? undefined : mailed.error,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/admins failed", error);
    return NextResponse.json(
      { error: "Could not create team member" },
      { status: 500 },
    );
  }
}
