import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { sendFacePhotosLinkEmail } from "@/lib/email";
import {
  createFaceShareToken,
  faceSharePageUrl,
} from "@/lib/face-share";
import {
  createPersonFromSelfieMatch,
  getFacePerson,
  listFaceDetections,
  listFaceMergeLogs,
  listFacePeople,
  mergeFacePeople,
  mergeFacePeopleMany,
  renameFacePerson,
  undoLastFaceMerge,
} from "@/lib/face-store";
import { isRekognitionConfigured } from "@/lib/rekognition";
import { listRsvps, readStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** List clustered people for the dashboard Faces tab. */
export async function GET() {
  try {
    if (!(await requirePermission("faces"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [people, store, mergeLogs, detections] = await Promise.all([
      listFacePeople(),
      readStore(),
      listFaceMergeLogs(1),
      listFaceDetections(),
    ]);

    const imageById = new Map(store.gallery.map((item) => [item.id, item]));
    const detectionByFaceId = new Map(
      detections.map((item) => [item.faceId, item]),
    );

    const rows = people
      .map((person) => {
        const rep = detectionByFaceId.get(person.representativeFaceId);
        const image = rep ? imageById.get(rep.imageId) : null;
        return {
          id: person.id,
          name: person.name,
          photoCount: person.imageIds.length,
          faceCount: person.faceIds.length,
          updatedAt: person.updatedAt,
          preview: image
            ? {
                imageId: image.id,
                src: image.src,
                alt: image.alt,
                boundingBox: rep?.boundingBox,
              }
            : null,
        };
      })
      .sort((a, b) => {
        const named = Number(Boolean(b.name)) - Number(Boolean(a.name));
        if (named !== 0) return named;
        return b.photoCount - a.photoCount;
      });

    const lastMerge = mergeLogs[0] || null;
    const canUndo =
      Boolean(lastMerge) &&
      Date.now() - new Date(lastMerge!.createdAt).getTime() <
        24 * 60 * 60 * 1000;

    return NextResponse.json({
      people: rows,
      total: rows.length,
      rekognitionReady: isRekognitionConfigured(),
      canUndoMerge: canUndo,
      lastMergeAt: lastMerge?.createdAt,
    });
  } catch (error) {
    console.error("GET /api/face/people failed", error);
    return NextResponse.json(
      { error: "Could not load faces" },
      { status: 500 },
    );
  }
}

const renameSchema = z.object({
  action: z.literal("rename").optional(),
  id: z.string().trim().min(1),
  name: z.string().trim().max(80),
});

const mergeSchema = z.object({
  action: z.literal("merge"),
  /** Multi-select: merge all into one person */
  personIds: z.array(z.string().trim().min(1)).min(2).optional(),
  /** Optional survivor when using personIds */
  targetId: z.string().trim().min(1).optional(),
  /** Legacy pairwise */
  sourceId: z.string().trim().min(1).optional(),
});

const undoSchema = z.object({
  action: z.literal("undo_merge"),
});

const sendSchema = z.object({
  action: z.literal("send_link"),
  personId: z.string().trim().min(1).optional(),
  /** Prefer sending to a saved RSVP — uses their RSVP / Google email */
  rsvpId: z.string().trim().min(1).optional(),
  email: z.string().trim().optional(),
  name: z.string().trim().max(80).optional(),
});

function resolveRsvpContact(rsvp: {
  name: string;
  email?: string;
  authEmail?: string;
}) {
  const email = (rsvp.email || rsvp.authEmail || "").trim();
  return { name: rsvp.name.trim(), email };
}

/** Rename / merge / undo / send link (JSON). */
export async function PATCH(request: Request) {
  try {
    if (!(await requirePermission("faces"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    if (body?.action === "merge") {
      const parsed = mergeSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid merge" }, { status: 400 });
      }

      if (parsed.data.personIds && parsed.data.personIds.length >= 2) {
        const person = await mergeFacePeopleMany(
          parsed.data.personIds,
          parsed.data.targetId,
        );
        return NextResponse.json({
          person,
          merged: true,
          mergedCount: parsed.data.personIds.length,
        });
      }

      if (parsed.data.sourceId && parsed.data.targetId) {
        const person = await mergeFacePeople(
          parsed.data.sourceId,
          parsed.data.targetId,
        );
        return NextResponse.json({
          person,
          merged: true,
          mergedFromIds: [parsed.data.sourceId],
        });
      }

      return NextResponse.json(
        { error: "Select at least two faces to merge" },
        { status: 400 },
      );
    }

    if (body?.action === "undo_merge") {
      const parsed = undoSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid undo" }, { status: 400 });
      }
      const result = await undoLastFaceMerge();
      return NextResponse.json({ ok: true, ...result });
    }

    if (body?.action === "send_link") {
      const parsed = sendSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || "Invalid request" },
          { status: 400 },
        );
      }
      if (!parsed.data.personId) {
        return NextResponse.json(
          { error: "personId required for send_link" },
          { status: 400 },
        );
      }
      const person = await getFacePerson(parsed.data.personId);
      if (!person) {
        return NextResponse.json({ error: "Person not found" }, { status: 404 });
      }
      if (person.imageIds.length === 0) {
        return NextResponse.json(
          { error: "This person has no photos yet" },
          { status: 400 },
        );
      }

      let toEmail = (parsed.data.email || "").trim();
      let toName = (parsed.data.name || person.name || "").trim();

      if (parsed.data.rsvpId) {
        const rsvps = await listRsvps();
        const rsvp = rsvps.find((item) => item.id === parsed.data.rsvpId);
        if (!rsvp) {
          return NextResponse.json(
            { error: "RSVP guest not found" },
            { status: 404 },
          );
        }
        const contact = resolveRsvpContact(rsvp);
        if (!contact.email) {
          return NextResponse.json(
            {
              error:
                "This RSVP has no email. Ask them to RSVP while signed in with Google, or add email on their RSVP.",
            },
            { status: 400 },
          );
        }
        toEmail = contact.email;
        toName = contact.name || toName;
      }

      if (!toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
        return NextResponse.json(
          { error: "Pick an RSVP guest with an email, or enter an email" },
          { status: 400 },
        );
      }

      const token = createFaceShareToken({
        personId: person.id,
        imageIds: person.imageIds,
        email: toEmail,
        name: toName,
      });
      const albumUrl = faceSharePageUrl(token);
      const sent = await sendFacePhotosLinkEmail({
        to: toEmail,
        name: toName,
        albumUrl,
        photoCount: person.imageIds.length,
      });
      if (!sent.ok) {
        return NextResponse.json({ error: sent.error }, { status: 502 });
      }
      return NextResponse.json({
        ok: true,
        albumUrl,
        photoCount: person.imageIds.length,
        emailedTo: toEmail,
        guestName: toName,
      });
    }

    const parsed = renameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid name" },
        { status: 400 },
      );
    }

    const { person, mergedFromIds } = await renameFacePerson(
      parsed.data.id,
      parsed.data.name,
    );
    return NextResponse.json({
      person,
      merged: mergedFromIds.length > 0,
      mergedFromIds,
    });
  } catch (error) {
    console.error("PATCH /api/face/people failed", error);
    const message =
      error instanceof Error ? error.message : "Could not update faces";
    const status = message.includes("not found")
      ? 404
      : message.includes("undo") || message.includes("Nothing")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Merge (legacy) or create person from selfie + send. */
export async function POST(request: Request) {
  try {
    if (!(await requirePermission("faces"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";

    // Multipart: selfie + RSVP email → match → optional send
    if (contentType.includes("multipart/form-data")) {
      if (!isRekognitionConfigured()) {
        return NextResponse.json(
          { error: "AWS Rekognition is not configured" },
          { status: 503 },
        );
      }
      const form = await request.formData();
      const file = form.get("selfie");
      let email = String(form.get("email") || "").trim();
      let name = String(form.get("name") || "").trim();
      const rsvpId = String(form.get("rsvpId") || "").trim();
      const send = String(form.get("send") || "") === "1";

      if (rsvpId) {
        const rsvps = await listRsvps();
        const rsvp = rsvps.find((item) => item.id === rsvpId);
        if (!rsvp) {
          return NextResponse.json(
            { error: "RSVP guest not found" },
            { status: 404 },
          );
        }
        const contact = resolveRsvpContact(rsvp);
        email = contact.email || email;
        name = contact.name || name;
      }

      if (!(file instanceof File) || file.size < 1) {
        return NextResponse.json(
          { error: "Upload a clear face photo" },
          { status: 400 },
        );
      }
      if (!name) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }

      const { person, imageIds } = await createPersonFromSelfieMatch({
        name,
        file,
      });

      if (send) {
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return NextResponse.json(
            {
              error:
                "Pick an RSVP with an email (or enter one) to send the album link",
            },
            { status: 400 },
          );
        }
        const token = createFaceShareToken({
          personId: person.id,
          imageIds,
          email,
          name,
        });
        const albumUrl = faceSharePageUrl(token);
        const sent = await sendFacePhotosLinkEmail({
          to: email,
          name,
          albumUrl,
          photoCount: imageIds.length,
        });
        if (!sent.ok) {
          return NextResponse.json(
            { person, imageIds, error: sent.error },
            { status: 502 },
          );
        }
        return NextResponse.json({
          ok: true,
          person,
          imageIds,
          photoCount: imageIds.length,
          emailed: true,
          emailedTo: email,
        });
      }

      return NextResponse.json({
        ok: true,
        person,
        imageIds,
        photoCount: imageIds.length,
        emailed: false,
      });
    }

    const body = await request.json().catch(() => ({}));
    if (body?.action === "merge" || body?.personIds || (body?.sourceId && body?.targetId)) {
      if (Array.isArray(body.personIds) && body.personIds.length >= 2) {
        const person = await mergeFacePeopleMany(
          body.personIds,
          body.targetId,
        );
        return NextResponse.json({
          person,
          merged: true,
          mergedCount: body.personIds.length,
        });
      }
      if (body.sourceId && body.targetId) {
        if (body.sourceId === body.targetId) {
          return NextResponse.json(
            { error: "Pick two different people to merge" },
            { status: 400 },
          );
        }
        const person = await mergeFacePeople(body.sourceId, body.targetId);
        return NextResponse.json({
          person,
          merged: true,
          mergedFromIds: [body.sourceId],
        });
      }
      return NextResponse.json(
        { error: "Select at least two faces to merge" },
        { status: 400 },
      );
    }

    // RSVP suggestions — use guest RSVP / Google email
    if (body?.action === "rsvp_suggestions") {
      const q = String(body.query || "")
        .trim()
        .toLowerCase();
      const rsvps = await listRsvps();
      const suggestions = rsvps
        .map((item) => {
          const email = (item.email || item.authEmail || "").trim();
          return {
            id: item.id,
            name: item.name,
            email,
            hasEmail: Boolean(email),
            attendance: item.attendance,
          };
        })
        .filter((item) => {
          if (!q) return item.hasEmail;
          const hay = `${item.name} ${item.email}`.toLowerCase();
          return hay.includes(q);
        })
        .sort((a, b) => {
          // Prefer exact name match, then has email, then alpha
          const aq = q && a.name.toLowerCase() === q ? 0 : 1;
          const bq = q && b.name.toLowerCase() === q ? 0 : 1;
          if (aq !== bq) return aq - bq;
          if (a.hasEmail !== b.hasEmail) return a.hasEmail ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .slice(0, 30);
      return NextResponse.json({ suggestions });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/face/people failed", error);
    const message =
      error instanceof Error ? error.message : "Could not process request";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
