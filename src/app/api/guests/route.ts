import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { listGuestLogins } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requirePermission("guests"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const guests = await listGuestLogins();
  return NextResponse.json({ guests });
}
