"use client";

import { createContext, useContext, type ReactNode } from "react";
import { isTileVariant, type TileVariant } from "@/lib/tileVariants";

const TileVariantContext = createContext<TileVariant>("bento");

export function TileVariantProvider({ variant, children }: { variant?: string | null; children: ReactNode }) {
  return <TileVariantContext.Provider value={isTileVariant(variant) ? variant : "bento"}>{children}</TileVariantContext.Provider>;
}

export function TileVariantSwitch({ options }: { options: Partial<Record<TileVariant, ReactNode>> }) {
  const variant = useContext(TileVariantContext);
  return <>{options[variant] ?? options.bento}</>;
}
