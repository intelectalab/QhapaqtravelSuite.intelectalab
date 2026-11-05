"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Me } from "@/lib/me";

const SessionContext = createContext<Me | null>(null);

export function SessionProvider({ me, children }: { me: Me; children: ReactNode }) {
  return <SessionContext.Provider value={me}>{children}</SessionContext.Provider>;
}

export function useMe(): Me {
  const me = useContext(SessionContext);
  if (!me) throw new Error("useMe debe usarse dentro de SessionProvider");
  return me;
}

export function useCan(permission: string): boolean {
  return useMe().permissions.includes(permission);
}
