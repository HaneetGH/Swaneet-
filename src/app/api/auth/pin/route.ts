import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMaster, verifyMasterPin } from "@/lib/auth";
import { hashPin } from "@/lib/pin";
import { updateAdminPinHash } from "@/lib/store";

const schema = z.object({
  currentPin: z.string().min(4, "Current PIN is required"),
  newPin: z
    .string()
    .min(4, "New PIN must be at least 4 characters")
    .max(32, "New PIN must be at most 32 characters"),
  confirmPin: z.string().min(4),
});

export async function PUT(request: Request) {
  if (!(await requireMaster())) {
    return NextResponse.json(
      { error: "Only master can change the master PIN" },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 },
    );
  }

  const { currentPin, newPin, confirmPin } = parsed.data;

  if (newPin !== confirmPin) {
    return NextResponse.json(
      { error: "New PIN and confirmation do not match" },
      { status: 400 },
    );
  }

  if (newPin === currentPin) {
    return NextResponse.json(
      { error: "New PIN must be different from the current PIN" },
      { status: 400 },
    );
  }

  if (!(await verifyMasterPin(currentPin))) {
    return NextResponse.json(
      { error: "Current PIN is incorrect" },
      { status: 401 },
    );
  }

  await updateAdminPinHash(hashPin(newPin));

  return NextResponse.json({ ok: true });
}
