"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { siteHref } from "@/lib/site";
import { withTextOverrides, type SiteDesign } from "@/lib/site-design";
import { DATE_LOCALE, SITE_TEXT, type SiteLocale } from "@/lib/site-i18n";

interface SiteValue {
  agencia: string;
  base: string;
  name: string;
  locale: SiteLocale;
  design: SiteDesign | null;
}

const SiteContext = createContext<SiteValue>({ agencia: "", base: "", name: "", locale: "es", design: null });

export function SiteProvider({ value, children }: { value: SiteValue; children: ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const site = useContext(SiteContext);
  const t = useMemo(() => withTextOverrides(SITE_TEXT[site.locale], site.design?.texts[site.locale], site.name), [site.locale, site.design, site.name]);
  return { ...site, t, dateLocale: DATE_LOCALE[site.locale], href: (path = "") => siteHref(site.base, path) };
}
