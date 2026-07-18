import { LoginForm } from "@/components/dashboard/LoginForm";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { isAuthenticated } from "@/lib/auth";
import { listEvents, listGallery, listRsvps } from "@/lib/store";

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

  const [events, gallery, rsvps] = await Promise.all([
    listEvents(),
    listGallery(),
    listRsvps(),
  ]);

  return <DashboardShell events={events} gallery={gallery} rsvps={rsvps} />;
}
