import { NextResponse } from "next/server";
import { requireMaster } from "@/lib/auth";
import { listEmailLogs } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireMaster())) {
    return NextResponse.json({ error: "Master only" }, { status: 403 });
  }
  const emails = await listEmailLogs();
  return NextResponse.json({ emails });
}
