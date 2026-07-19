import { LoginForm } from "@/components/dashboard/LoginForm";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getAdminSession, sessionHasPermission } from "@/lib/auth";
import {
  defaultStore,
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
    const [events, gallery, rsvps, accommodations] = await Promise.all([
      sessionHasPermission(session, "events") ||
      sessionHasPermission(session, "gallery")
        ? listEvents()
        : Promise.resolve([]),
      sessionHasPermission(session, "gallery")
        ? listGallery({ includePending: true })
        : Promise.resolve([]),
      sessionHasPermission(session, "rsvp")
        ? listRsvps()
        : Promise.resolve([]),
      sessionHasPermission(session, "stay")
        ? listAccommodations()
        : Promise.resolve([]),
    ]);

    return (
      <DashboardShell
        session={publicSession}
        events={events}
        gallery={gallery}
        rsvps={rsvps}
        accommodations={accommodations}
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
