"use client";

import { useEffect, useMemo, useState } from "react";
import {
  defaultFeatureFlags,
  featureSiteFromInviteTier,
  isFeatureEnabled,
} from "@/lib/feature-flags";
import { useInvite } from "@/lib/invite-context";
import type { FeatureFlags, FeatureKey, FeatureSite } from "@/lib/types";

export function useFeatureSite(): FeatureSite {
  const invite = useInvite();
  return featureSiteFromInviteTier(invite?.tier);
}

export function useFeatureFlags() {
  const site = useFeatureSite();
  const [flags, setFlags] = useState<FeatureFlags>(defaultFeatureFlags);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/feature-flags", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { flags?: FeatureFlags } | null) => {
        if (alive && data?.flags) setFlags(data.flags);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const enabled = useMemo(() => {
    return (key: FeatureKey) => isFeatureEnabled(flags, site, key);
  }, [flags, site]);

  return { flags, site, ready, enabled };
}
