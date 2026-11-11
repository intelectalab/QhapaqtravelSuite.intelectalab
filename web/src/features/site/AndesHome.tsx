"use client";

import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { siteHref, type Departure } from "@/lib/site";
import type { SiteLocale } from "@/lib/site-i18n";
import { useSite } from "./SiteContext";

const RISE = "animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]";

const LABELS: Record<SiteLocale, { seal: string; date: string; program: string; time: string; spots: string; price: string; book: string; left: (n: number) => string; full: string }> = {
  es: { seal: "Operador turístico", date: "Fecha", program: "Programa", time: "Hora", spots: "Cupos", price: "Desde", book: "Reservar", left: (n) => `${n} libres`, full: "Agotado" },
  en: { seal: "Tour operator", date: "Date", program: "Program", time: "Time", spots: "Seats", price: "From", book: "Book", left: (n) => `${n} left`, full: "Sold out" },
};

export function AndesHero({ title, body, seal, image, overlay, search, stats }: { title: string; body: string; seal: string | null; image: string | null; overlay: number; search: ReactNode; stats: string[] }) {
  const { locale } = useSite();
  return (
    <section data-testid="site-hero" data-hero-style="andes" className="relative isolate overflow-hidden bg-menu text-white">
      {image ? (
        <>
          <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
          <span aria-hidden className="absolute inset-0 -z-10" style={{ background: `rgb(15 39 71 / ${Math.max(overlay, 35) / 100})` }} />
        </>
      ) : (
        <span aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(900px_420px_at_50%_-10%,color-mix(in_srgb,var(--site-accent)_45%,transparent),transparent_70%)]" />
      )}
      <div className="mx-auto flex max-w-[1280px] flex-col items-center px-5 pb-16 pt-14 text-center sm:px-12 sm:pb-24 sm:pt-20">
        <span className={cn("inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-white/90 backdrop-blur", RISE)}>
          <ShieldCheck size={14} className="text-[var(--andes-gold)]" />
          {[LABELS[locale].seal, seal].filter(Boolean).join(" · ")}
        </span>
        <h1 className={cn("mt-5 max-w-[860px] text-[36px] leading-[44px] sm:text-[56px] sm:leading-[64px]", RISE)}>{title}</h1>
        <p className={cn("mt-4 max-w-[62ch] text-[17px] leading-[28px] text-white/80", RISE)}>{body}</p>
        {search && (
          <div className={cn("mt-9 w-full max-w-[1000px] rounded-[16px] border border-white/60 bg-white/[0.88] p-2 text-left text-fg shadow-[0_20px_32px_-8px_rgb(15_39_71/0.35)] backdrop-blur-[16px] dark:bg-surface/90", RISE)} style={{ animationDelay: "120ms" }}>
            {search}
          </div>
        )}
        {stats.length > 0 && (
          <ul className={cn("mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-white/75", RISE)} style={{ animationDelay: "220ms" }}>
            {stats.map((item, index) => (
              <li key={item} className="flex items-center gap-5">
                {index > 0 && <span aria-hidden className="h-3 w-px bg-white/30" />}
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function DepartureTable({ departures }: { departures: Departure[] }) {
  const { locale, dateLocale, base, t } = useSite();
  const L = LABELS[locale];
  const format = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(dateLocale, { ...options, timeZone: "America/Lima" }).format(new Date(`${date}T12:00:00`));
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-[0_2px_8px_rgb(15_39_71/0.04)]">
      <table className="w-full text-left text-[14px]">
        <thead className="hidden border-b border-line bg-[var(--andes-ice)] text-[11px] font-bold uppercase tracking-[0.08em] text-fg-3 md:table-header-group">
          <tr>
            <th className="px-5 py-3">{L.date}</th>
            <th className="px-5 py-3">{L.program}</th>
            <th className="px-5 py-3">{L.time}</th>
            <th className="px-5 py-3">{L.spots}</th>
            <th className="px-5 py-3 text-right">{L.price}</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {departures.map((departure) => {
            const href = siteHref(base, `/tours/${departure.product?.slug ?? ""}?fecha=${departure.date}`);
            const soldOut = departure.spots <= 0;
            return (
              <tr key={departure.ref} className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-b border-line px-5 py-4 transition-colors last:border-b-0 hover:bg-[var(--andes-ice)] md:table-row md:p-0">
                <td className="row-span-2 md:px-5 md:py-4">
                  <span className="block text-[22px] font-semibold leading-none text-fg" style={{ fontFamily: "var(--andes-serif)" }}>
                    {format(departure.date, { day: "2-digit" })}
                  </span>
                  <span className="text-[12px] font-semibold capitalize text-fg-3">{format(departure.date, { month: "short", weekday: "short" }).replace(".", "")}</span>
                </td>
                <td className="md:px-5 md:py-4">
                  <Link href={href} className="font-semibold text-fg transition-colors hover:text-[var(--site-accent)]">
                    {departure.product?.name}
                  </Link>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
                    {departure.product?.destination}
                    {departure.guaranteed && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ok)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-ok">
                        <ShieldCheck size={11} />
                        {t.cards.guaranteed}
                      </span>
                    )}
                  </span>
                </td>
                <td className="text-[13px] text-fg-2 md:px-5 md:py-4">{departure.time}</td>
                <td className="text-[13px] md:px-5 md:py-4">
                  <span className={cn("font-semibold", soldOut ? "text-bad" : departure.spots <= 4 ? "text-warn" : "text-fg-2")}>{soldOut ? L.full : L.left(departure.spots)}</span>
                </td>
                <td className="text-[15px] font-bold text-fg md:px-5 md:py-4 md:text-right">{departure.price ? formatMoney(departure.price.amount, departure.price.currency) : "—"}</td>
                <td className="col-span-2 mt-2 md:mt-0 md:px-5 md:py-4 md:text-right">
                  {!soldOut && (
                    <Link href={href} data-site-cta className="inline-flex h-10 items-center gap-1.5 rounded-control px-4 text-[13.5px] transition hover:-translate-y-0.5">
                      {L.book}
                      <ArrowRight size={15} />
                    </Link>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

