import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { isSampleWish } from "@/data/sample-wishes";
import {
  sendGuestWishLiveEmail,
  sendGuestWishNoteEmail,
  sendGuestWishReceivedEmail,
} from "@/lib/email";
import {
  deleteGuestMessage,
  listGuestMessages,
  moderateGuestMessages,
  setGuestMessageContactEmail,
} from "@/lib/store";
import type { GuestMessage } from "@/lib/types";

export const dynamic = "force-dynamic";

const moderateSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1).max(40),
  action: z.enum([
    "approve",
    "reject",
    "delete",
    "notify",
    /** @deprecated use notify */
    "notify_live",
  ]),
  /** Override / attach email when notifying a single wish that has none */
  email: z.string().trim().email().optional(),
});

async function sendStatusEmail(message: GuestMessage) {
  if (message.status === "approved") {
    return sendGuestWishLiveEmail(message);
  }
  if (message.status === "rejected") {
    return sendGuestWishNoteEmail(message);
  }
  // pending (and any other) → received / in review
  return sendGuestWishReceivedEmail(message);
}

function statusEmailLabel(status: GuestMessage["status"]) {
  if (status === "approved") return "live";
  if (status === "rejected") return "note";
  return "received";
}

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

/** Approve, reject, delete, or (re)send guest status emails. */
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

    if (
      parsed.data.action === "notify" ||
      parsed.data.action === "notify_live"
    ) {
      const all = await listGuestMessages({ includePending: true });
      const idSet = new Set(parsed.data.ids);
      let targets = all.filter(
        (item) => idSet.has(item.id) && !isSampleWish(item),
      );

      // Legacy notify_live: only approved
      if (parsed.data.action === "notify_live") {
        targets = targets.filter((item) => item.status === "approved");
      }

      if (parsed.data.email) {
        if (parsed.data.ids.length !== 1) {
          return NextResponse.json(
            { error: "Attach an email for one wish at a time" },
            { status: 400 },
          );
        }
        const updated = await setGuestMessageContactEmail(
          parsed.data.ids[0]!,
          parsed.data.email,
        );
        if (!updated) {
          return NextResponse.json(
            { error: "Wish not found or is a sample" },
            { status: 404 },
          );
        }
        targets = [updated];
      }

      let sent = 0;
      let skipped = 0;
      let failed = 0;
      const errors: string[] = [];
      const kinds: string[] = [];

      for (const message of targets) {
        if (!message.authEmail?.trim()) {
          skipped += 1;
          continue;
        }
        const result = await sendStatusEmail(message);
        if (result.ok) {
          sent += 1;
          kinds.push(statusEmailLabel(message.status));
        } else {
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
        kinds,
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
