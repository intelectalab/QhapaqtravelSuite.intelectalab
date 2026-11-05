"use client";

/**
 * Contexto de acceso del usuario en el navegador (solo para PRESENTAR: ocultar/deshabilitar; la API decide).
 *
 * Se carga en el layout del servidor con `GET /api/v1/me`, `GET /api/v1/me/permissions` y `GET /api/v1/me/access`
 * (spec 00 §6) y se pasa a <AccessProvider value={…}>. Cambios de permisos llegan por Reverb
 * (canal `private-tenant.{tenantId}.user.{userId}`) → `router.refresh()` vuelve a cargar el layout (09 T-13).
 *
 * Forma de /me/access según spec 00 §6: { experience, home, routes[], nav[], screens: { ruta: bool } }.
 * El contrato la publica como GenericObject: tipos escritos a mano (Supuesto hasta tiparla en el contrato).
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";

export type AccessData = {
  tenantId: string;
  userId: string;
  role: string;
  experience: "backoffice" | "portal" | "mobile" | "platform";
  /** own | tenant | linked (alcance de datos, spec 00 §6 GET /me). */
  scope: "own" | "tenant" | "linked";
  permissions: string[];
  screens: Record<string, boolean>;
};

type AccessValue = AccessData & {
  can: (permission: string | readonly string[]) => boolean;
  canSee: (route: string) => boolean;
};

const Ctx = createContext<AccessValue | null>(null);

export function AccessProvider({ value, children }: { value: AccessData; children: ReactNode }) {
  const memo = useMemo<AccessValue>(() => {
    const set = new Set(value.permissions);
    return {
      ...value,
      // «cualquiera de» (misma regla que ACCESS); sin comodines (el backend no los admite, spec 00 §7.1).
      can: (p) => (typeof p === "string" ? set.has(p) : p.some((x) => set.has(x))),
      canSee: (route) => value.screens[route] ?? true,
    };
  }, [value]);
  return <Ctx.Provider value={memo}>{children}</Ctx.Provider>;
}

export function useAccess(): AccessValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAccess() fuera de <AccessProvider>");
  return v;
}

/** Claves de TanStack Query siempre con el tenant (CLAUDE.md web: «claves por recurso y tenant»). */
export function useTenantKey(): readonly ["t", string] {
  const { tenantId } = useAccess();
  return ["t", tenantId] as const;
}
