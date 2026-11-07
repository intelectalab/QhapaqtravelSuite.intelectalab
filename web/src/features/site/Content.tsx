"use client";

import { ChevronDown, Compass } from "lucide-react";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, monthName } from "@/lib/format";
import type { DestinationDetail } from "@/lib/site";
import { useSite } from "./SiteContext";

const LEVEL_STYLE: Record<string, string> = {
  alta: "bg-[color-mix(in_srgb,var(--t3)_80%,transparent)] text-white",
  media: "bg-[color-mix(in_srgb,var(--t1)_70%,transparent)] text-white",
  baja: "bg-[color-mix(in_srgb,var(--t4)_75%,transparent)] text-white",
  especial: "bg-t2 text-t2-fg",
};

export function Faq({ items, className }: { items: { q: string; a: string }[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <div className={cn("divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card", className)}>
      {items.map((item, index) => (
        <details key={item.q} className="group animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 50}ms` }} open={index === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[14.5px] font-semibold text-fg transition hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown size={17} className="flex-none text-fg-3 transition-transform duration-300 group-open:rotate-180" />
          </summary>
          <p className="px-5 pb-4 text-[14px] leading-relaxed text-fg-2">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export function SeasonStrip({ months, special }: { months: DestinationDetail["months"]; special: DestinationDetail["special"] }) {
  const { t, dateLocale } = useSite();
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <ol className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-12">
        {months.map((item, index) => {
          const level = item.season?.level ?? "media";
          return (
            <li
              key={item.month}
              className={cn("group relative rounded-xl px-2 py-3 text-center transition hover:-translate-y-1 hover:shadow-[0_10px_20px_-12px_rgb(14_17_32/0.5)] animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]", item.season ? LEVEL_STYLE[level] : "bg-surface-2 text-fg-3")}
              style={{ animationDelay: `${index * 35}ms` }}
              title={item.season ? `${item.season.name} · factor ${item.season.factor.toFixed(2)}` : t.content.noSeason}
            >
              <b className="block text-[13px] font-semibold">{capitalize(monthName(item.month, dateLocale)).slice(0, 3)}</b>
              <span className="block text-[10.5px] opacity-80">{item.month.slice(0, 4)}</span>
            </li>
          );
        })}
      </ol>
      <ul className="mt-4 flex flex-wrap gap-3 text-[12px] text-fg-2">
        {(["alta", "media", "baja", "especial"] as const).map((level) => (
          <li key={level} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full", LEVEL_STYLE[level].split(" ")[0])} />
            {t.seasons[level]}
          </li>
        ))}
      </ul>
      {special.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <h3 className="text-[13px] font-semibold text-fg">{t.content.specialDates}</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {special.map((item) => (
              <li key={item.name} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px]">
                <span>
                  <b className="font-semibold text-fg">{item.name}</b>
                  <span className="block text-fg-3">
                    {t.content.range(formatDate(item.from, "short", dateLocale), formatDate(item.to, "short", dateLocale))}
                  </span>
                </span>
                <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", item.factor >= 1 ? "bg-[color-mix(in_srgb,var(--warn)_15%,transparent)] text-warn" : "bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] text-ok")}>
                  {item.factor >= 1 ? "+" : "−"}
                  {Math.abs(Math.round((item.factor - 1) * 100))} %
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function LocationMap({ name, lat, lng }: { name: string; lat: number; lng: number }) {
  const { t } = useSite();
  const x = ((lng + 81.5) / 13) * 100;
  const y = ((-lat - 0) / 18.5) * 100;
  return (
    <figure className="relative overflow-hidden rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-[color-mix(in_srgb,var(--t1)_7%,var(--surface))]">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden className="absolute inset-0 h-full w-full">
          {[20, 40, 60, 80].map((line) => (
            <g key={line} stroke="var(--line)" strokeWidth="0.3">
              <line x1={line} y1="0" x2={line} y2="100" />
              <line x1="0" y1={line} x2="100" y2={line} />
            </g>
          ))}
          <path d="M8 18 L30 4 L52 8 L70 22 L78 46 L96 60 L94 84 L82 100 L60 96 L40 78 L26 60 L16 40 Z" fill="color-mix(in srgb, var(--t1) 14%, transparent)" stroke="color-mix(in srgb, var(--t1) 45%, transparent)" strokeWidth="0.6" />
        </svg>
        <span className="absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center" style={{ left: `${Math.min(96, Math.max(4, x))}%`, top: `${Math.min(96, Math.max(4, y))}%` }}>
          <span className="absolute h-8 w-8 animate-ping rounded-full bg-[color-mix(in_srgb,var(--brand)_35%,transparent)]" />
          <span className="relative grid h-4 w-4 place-items-center rounded-full border-2 border-surface bg-brand shadow" />
        </span>
      </div>
      <figcaption className="mt-3 flex items-center justify-between gap-2 text-[12.5px] text-fg-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-fg">
          <Compass size={14} className="text-brand" />
          {name}
        </span>
        <span className="tabular-nums text-fg-3">
          {Math.abs(lat).toFixed(2)}° S · {Math.abs(lng).toFixed(2)}° {t.content.west}
        </span>
      </figcaption>
    </figure>
  );
}
