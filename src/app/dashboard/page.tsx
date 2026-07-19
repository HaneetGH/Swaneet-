import { LoginForm } from "@/components/dashboard/LoginForm";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { isAuthenticated } from "@/lib/auth";
import {
  defaultStore,
  listAccommodations,
  listEvents,
  listGallery,
  listRsvps,
} from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const authed = await isAuthenticated();

  if (!authed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07060a] px-5">
        <LoginForm />
      </main>
    );
  }

  try {
    const [events, gallery, rsvps, accommodations] = await Promise.all([
      listEvents(),
      listGallery({ includePending: true }),
      listRsvps(),
      listAccommodations(),
    ]);

    return (
      <DashboardShell
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
        events={fallback.events}
        gallery={fallback.gallery}
        rsvps={fallback.rsvps}
        accommodations={fallback.accommodations}
        loadError={message}
      />
    );
  }
}
