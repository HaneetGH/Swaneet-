"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SmoothScroll } from "@/components/effects/SmoothScroll";
import { ScrollProgress } from "@/components/effects/ScrollProgress";
import { CursorGlow } from "@/components/effects/CursorGlow";
import { MouseLight } from "@/components/effects/MouseLight";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { OpenInvitation } from "@/components/ui/OpenInvitation";
import {
  defaultFeatureFlags,
  featureSiteFromPathname,
  isFeatureEnabled,
} from "@/lib/feature-flags";
import type { FeatureFlags } from "@/lib/types";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");
  const site = useMemo(
    () => featureSiteFromPathname(pathname),
    [pathname],
  );

  const [flags, setFlags] = useState<FeatureFlags>(defaultFeatureFlags);
  const [flagsReady, setFlagsReady] = useState(isDashboard);
  const [loading, setLoading] = useState(!isDashboard);
  const [sealed, setSealed] = useState(!isDashboard);

  useEffect(() => {
    if (isDashboard) {
      setFlagsReady(true);
      return;
    }

    let alive = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);

    fetch("/api/feature-flags", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { flags?: FeatureFlags } | null) => {
        if (alive && data?.flags) setFlags(data.flags);
      })
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(timeout);
        if (alive) setFlagsReady(true);
      });

    return () => {
      alive = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [isDashboard]);

  const landingEnabled = isFeatureEnabled(flags, site, "landing");

  useEffect(() => {
    if (!flagsReady || isDashboard) return;
    if (!landingEnabled) {
      setLoading(false);
      setSealed(false);
    }
  }, [flagsReady, landingEnabled, isDashboard]);

  const onLoadComplete = useCallback(() => setLoading(false), []);

  if (isDashboard) {
    return <>{children}</>;
  }

  // Wait for flag so we don't flash the sealed scroll when landing is off.
  if (!flagsReady) {
    return (
      <div
        className="fixed inset-0 z-[100] bg-[#07060a]"
        aria-busy="true"
        aria-label="Loading"
      />
    );
  }

  if (!landingEnabled) {
    return (
      <>
        <SmoothScroll enabled />
        <ScrollProgress />
        <CursorGlow />
        <MouseLight />
        <div className="animate-fade-in [animation-duration:0.6s]">
          {children}
        </div>
      </>
    );
  }

  const ready = !loading && !sealed;

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
          <div className="animate-fade-in [animation-duration:1.1s]">
            {children}
          </div>
        </>
      ) : null}
    </>
  );
}
