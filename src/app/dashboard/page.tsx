import { LoginForm } from "@/components/dashboard/LoginForm";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getAdminSession, sessionHasPermission } from "@/lib/auth";
import {
  defaultStore,
  getRoomInventory,
  listAccommodations,
  listEvents,
  listGallery,
  listRsvps,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getAdminSession();

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07060a] px-5">
        <LoginForm />
      </main>
    );
  }

  const publicSession = {
    kind: session.kind,
    name: session.name,
    permissions: session.permissions,
  };

  try {
    const canUpload = sessionHasPermission(session, "gallery_upload");
    const canReview = sessionHasPermission(session, "gallery_review");
    const [events, gallery, rsvps, accommodations, inventory] =
      await Promise.all([
        sessionHasPermission(session, "events") || canUpload || canReview
          ? listEvents()
          : Promise.resolve([]),
        canUpload || canReview
          ? listGallery({ includePending: canReview || canUpload })
          : Promise.resolve([]),
        sessionHasPermission(session, "rsvp")
          ? listRsvps()
          : Promise.resolve([]),
        sessionHasPermission(session, "stay")
          ? listAccommodations()
          : Promise.resolve([]),
        sessionHasPermission(session, "stay")
          ? getRoomInventory()
          : Promise.resolve({
              total: 0,
              assigned: 0,
              blocked: 0,
              available: 0,
              hotels: [],
            }),
      ]);

    return (
      <DashboardShell
        session={publicSession}
        events={events}
        gallery={gallery}
        rsvps={rsvps}
        accommodations={accommodations}
        inventory={inventory}
      />
    );
  } catch (error) {
    console.error("Dashboard load failed", error);
    const fallback = defaultStore();
    const message =
      error instanceof Error
        ? error.message
        : "Could not load dashboard data. Check Neon storage in Vercel.";

    return (
      <DashboardShell
        session={publicSession}
        events={fallback.events}
        gallery={fallback.gallery}
        rsvps={fallback.rsvps}
        accommodations={fallback.accommodations}
        loadError={message}
      />
    );
  }
}
