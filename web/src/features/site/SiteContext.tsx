"use client";

import { createContext, useContext, type ReactNode } from "react";
import { siteHref } from "@/lib/site";
import { DATE_LOCALE, SITE_TEXT, type SiteLocale } from "@/lib/site-i18n";

interface SiteValue {
  agencia: string;
  base: string;
  name: string;
  locale: SiteLocale;
}

const SiteContext = createContext<SiteValue>({ agencia: "", base: "", name: "", locale: "es" });

export function SiteProvider({ value, children }: { value: SiteValue; children: ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const site = useContext(SiteContext);
  return { ...site, t: SITE_TEXT[site.locale], dateLocale: DATE_LOCALE[site.locale], href: (path = "") => siteHref(site.base, path) };
}
