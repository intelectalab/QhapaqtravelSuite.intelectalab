"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { NAV_GROUPS, type NavGroup } from "@/config/navigation";
import { PLATFORM_NAV_GROUPS } from "@/config/platformNavigation";

export type NavigationId = "agency" | "platform";

export interface WorkspaceInfo {
  navigation: NavigationId;
  userId: string;
  account: { name: string; detail: string | null; initials: string };
  person: { name: string; email: string; detail: string; color: string | null };
  logoutHref: string;
}

export interface Workspace extends WorkspaceInfo {
  groups: NavGroup[];
  searchHint: string;
}

const NAVIGATIONS: Record<NavigationId, { groups: NavGroup[]; searchHint: string }> = {
  agency: { groups: NAV_GROUPS, searchHint: "Busca o pregunta: “reservas sin pagar de octubre”" },
  platform: { groups: PLATFORM_NAV_GROUPS, searchHint: "Busca o pregunta: “agencias con la prueba por vencer”" },
};

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceInfo; children: ReactNode }) {
  const workspace = useMemo(() => ({ ...value, ...NAVIGATIONS[value.navigation] }), [value]);
  return <WorkspaceContext.Provider value={workspace}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): Workspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("useWorkspace debe usarse dentro de WorkspaceProvider");
  return workspace;
}
