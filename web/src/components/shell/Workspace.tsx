"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { NAV_GROUPS, type NavGroup } from "@/config/navigation";
import { PLATFORM_NAV_GROUPS } from "@/config/platformNavigation";
import { isAllowed } from "@/lib/access";
import type { NavCounts } from "@/lib/dashboard";

export type NavigationId = "agency" | "platform";

export interface WorkspaceInfo {
  navigation: NavigationId;
  userId: string;
  account: { name: string; detail: string | null; initials: string };
  person: { name: string; email: string; detail: string; color: string | null };
  logoutHref: string;
  counts: NavCounts;
  screens: Record<string, boolean> | null;
}

export interface Workspace extends WorkspaceInfo {
  groups: NavGroup[];
  searchHint: string;
  allows: (path: string) => boolean;
}

const NAVIGATIONS: Record<NavigationId, { groups: NavGroup[]; searchHint: string }> = {
  agency: { groups: NAV_GROUPS, searchHint: "Busca clientes, cotizaciones, reservas o productos" },
  platform: { groups: PLATFORM_NAV_GROUPS, searchHint: "Busca agencias, facturas, planes, cupones o pantallas" },
};

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceInfo; children: ReactNode }) {
  const workspace = useMemo(() => {
    const base = NAVIGATIONS[value.navigation];
    const allows = (path: string) => isAllowed(value.screens, path);
    const groups = base.groups
      .map((group) => ({ ...group, screens: group.screens.filter((screen) => allows(screen.href)) }))
      .filter((group) => group.screens.length > 0);
    return { ...value, ...base, groups, allows };
  }, [value]);
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace debe usarse dentro de WorkspaceProvider");
  return workspace;
}
