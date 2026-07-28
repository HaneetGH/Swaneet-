import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { isSampleWish } from "@/data/sample-wishes";
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
  action: z.enum(["approve", "reject", "delete", "notify_live"]),
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

/** Approve, reject, delete, or re-notify live wishes. */
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

    if (parsed.data.action === "notify_live") {
      const all = await listGuestMessages({ includePending: true });
      const idSet = new Set(parsed.data.ids);
      const targets = all.filter(
        (item) =>
          idSet.has(item.id) &&
          item.status === "approved" &&
          !isSampleWish(item),
      );

      let sent = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const message of targets) {
        if (!message.authEmail?.trim()) {
          skipped += 1;
          continue;
        }
        const result = await sendGuestWishLiveEmail(message);
        if (result.ok) sent += 1;
        else {
          failed += 1;
          if (result.error) {
            errors.push(`${message.displayName}: ${result.error}`);
          }
        }
      }

      const ignored = parsed.data.ids.length - targets.length;
      return NextResponse.json({
        sent,
        skipped,
        failed,
        ignored,
        errors: errors.slice(0, 5),
      });
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
