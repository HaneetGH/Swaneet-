"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  eventsForInvite,
  type BrideInvite,
  type BrideInviteTier,
} from "@/data/bride-invites";
import type { ManagedEvent } from "@/lib/types";

export type InviteContextValue = {
  side: "bride";
  invite: BrideInvite;
  tier: BrideInviteTier;
  slug: string;
  events: ManagedEvent[];
  basePath: string;
};

const InviteContext = createContext<InviteContextValue | null>(null);

export function InviteProvider({
  invite,
  children,
}: {
  invite: BrideInvite;
  children: ReactNode;
}) {
  const value = useMemo<InviteContextValue>(
    () => ({
      side: "bride",
      invite,
      tier: invite.tier,
      slug: invite.slug,
      events: eventsForInvite(invite),
      basePath: `/i/${invite.slug}`,
    }),
    [invite],
  );

  return (
    <InviteContext.Provider value={value}>{children}</InviteContext.Provider>
  );
}

export function useInvite() {
  return useContext(InviteContext);
}
