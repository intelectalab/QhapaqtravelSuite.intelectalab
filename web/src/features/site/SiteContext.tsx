"use client";

import { createContext, useContext, type ReactNode } from "react";
import { siteHref } from "@/lib/site";

interface SiteValue {
  agencia: string;
  base: string;
  name: string;
}

const SiteContext = createContext<SiteValue>({ agencia: "", base: "", name: "" });

export function SiteProvider({ value, children }: { value: SiteValue; children: ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const site = useContext(SiteContext);
  return { ...site, href: (path = "") => siteHref(site.base, path) };
}
