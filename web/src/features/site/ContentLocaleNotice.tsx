"use client";

import { Languages } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSite } from "./SiteContext";

export function ContentLocaleNotice({ contentLocale, className }: { contentLocale?: string; className?: string }) {
  const { locale, t } = useSite();
  if (locale === "es" || !contentLocale || contentLocale === locale) return null;
  return (
    <p data-testid="content-locale-notice" className={cn("flex items-start gap-2.5 rounded-xl bg-[color-mix(in_srgb,var(--t2)_14%,transparent)] px-4 py-3 text-[13px] text-fg-2", className)}>
      <Languages size={16} className="mt-0.5 flex-none text-[color-mix(in_srgb,var(--t2)_60%,var(--fg))]" />
      <span>
        <b className="font-semibold text-fg">{t.fallback.title}.</b> {t.fallback.body}
      </span>
    </p>
  );
}
