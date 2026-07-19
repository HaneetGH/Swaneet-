import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getStorageInfo } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(getStorageInfo());
}
