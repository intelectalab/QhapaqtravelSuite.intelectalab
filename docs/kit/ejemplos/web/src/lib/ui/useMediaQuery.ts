"use client";

/** Media query reactiva y segura para SSR (false en el servidor). Breakpoints del prototipo v2.4: 900 / 640 px. */
import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export const NARROW = "(max-width: 900px)"; // tablas → tarjetas (ResponsiveTables)
export const PHONE = "(max-width: 640px)"; // topbar compacta, hoja de acciones
