import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import {
  sendGuestWishLiveEmail,
  sendGuestWishNoteEmail,
} from "@/lib/email";
import {
  deleteGuestMessage,
  listGuestMessages,
  moderateGuestMessages,
} from "@/lib/store";

export const dynamic = "force-dynamic";

const moderateSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(40),
  action: z.enum(["approve", "reject", "delete"]),
});

/** Admin list of all wishes (including pending). */
export async function GET() {
  try {
    const session = await requirePermission("messages");
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const messages = await listGuestMessages({ includePending: true });
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("GET /api/messages/moderate failed", error);
    return NextResponse.json(
      { error: "Could not load wishes" },
      { status: 500 },
    );
  }
}

/** Approve, reject, or delete guest wishes. */
export async function POST(request: Request) {
  try {
    const session = await requirePermission("messages");
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = moderateSchema.safeParse(
      await request.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid request" },
        { status: 400 },
      );
    }

    if (parsed.data.action === "delete") {
      let deleted = 0;
      for (const id of parsed.data.ids) {
        if (await deleteGuestMessage(id)) deleted += 1;
      }
      return NextResponse.json({ deleted });
    }

    const messages = await moderateGuestMessages({
      ids: parsed.data.ids,
      action: parsed.data.action,
      moderatedBy: session.name || session.kind,
    });

    await Promise.all(
      messages.map(async (message) => {
        if (parsed.data.action === "approve") {
          await sendGuestWishLiveEmail(message).catch((error) =>
            console.error("Wish live email failed", error),
          );
          return;
        }
        await sendGuestWishNoteEmail(message).catch((error) =>
          console.error("Wish note email failed", error),
        );
      }),
    );

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("POST /api/messages/moderate failed", error);
    return NextResponse.json(
      { error: "Could not update wishes" },
      { status: 500 },
    );
  }
}
