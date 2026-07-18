"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { SmoothScroll } from "@/components/effects/SmoothScroll";
import { ScrollProgress } from "@/components/effects/ScrollProgress";
import { CursorGlow } from "@/components/effects/CursorGlow";
import { MouseLight } from "@/components/effects/MouseLight";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { OpenInvitation } from "@/components/ui/OpenInvitation";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  const [loading, setLoading] = useState(!isDashboard);
  const [sealed, setSealed] = useState(!isDashboard);

  const onLoadComplete = useCallback(() => setLoading(false), []);
  const ready = isDashboard || (!loading && !sealed);

  if (isDashboard) {
    return <>{children}</>;
  }

  return (
    <>
      {loading ? <LoadingScreen onComplete={onLoadComplete} /> : null}
      {!loading && sealed ? (
        <OpenInvitation open onOpen={() => setSealed(false)} />
      ) : null}

      {ready ? (
        <>
          <SmoothScroll enabled />
          <ScrollProgress />
          <CursorGlow />
          <MouseLight />
          <div className="animate-fade-in">{children}</div>
        </>
      ) : null}
    </>
  );
}
