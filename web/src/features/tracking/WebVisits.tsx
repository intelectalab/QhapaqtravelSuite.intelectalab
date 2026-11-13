"use client";

import { Coins, Eye, Radio, Target, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart } from "@/components/ui/Charts";
import { TintTile } from "@/components/ui/Tinted";
import { TileGrid } from "@/features/channels/ChannelUi";
import { cn } from "@/lib/cn";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { deltaPercent, secondsLabel, type WebDevices, type WebOverview, type WebPage, type WebSource } from "@/lib/tracking";

const COUNTRY: Record<string, string> = { PE: "Perú", US: "Estados Unidos", ES: "España", MX: "México", CL: "Chile", AR: "Argentina", BR: "Brasil", CO: "Colombia", DE: "Alemania", FR: "Francia", ZZ: "Otros" };

function deltaNote(current: number, previous: number | undefined, suffix: string): string {
  const delta = deltaPercent(current, previous);
  return delta === null ? suffix : `${delta >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(delta), 1)} vs. periodo anterior`;
}

export function PeriodSwitch({ base, days, extra = "" }: { base: string; days: number; extra?: string }) {
  return (
    <span className="inline-flex overflow-hidden rounded-control border border-line">
      {[7, 30, 90].map((option) => (
        <Link key={option} href={`${base}?days=${option}${extra}`} className={cn("px-3 py-1.5 text-[13px] font-semibold transition", option === days ? "bg-accent text-white" : "text-fg-2 hover:bg-surface-2")}>
          {option} días
        </Link>
      ))}
    </span>
  );
}

export function VisitTiles({ overview, conversionLabel = "Conversiones", showRevenue = true }: { overview: WebOverview; conversionLabel?: string; showRevenue?: boolean }) {
  const { kpis, previous } = overview;
  return (
    <TileGrid>
      <TintTile icon={Eye} tone="t4" label="Visitas" value={formatNumber(kpis.visits)} note={deltaNote(kpis.visits, previous?.visits, `${overview.period.days} días`)} info={<p>Visitas contadas sin cookies (hash diario, sin IP ni datos personales). Una visita termina tras 30 minutos sin actividad; se excluyen bots.</p>} />
      <TintTile icon={Users} tone="info" label="Visitantes" value={formatNumber(kpis.visitors)} note={`${kpis.pages_per_visit.toLocaleString("es-PE")} páginas por visita`} info={<p>Personas distintas en el día, agregadas por página de entrada. El hash cambia cada día, así que no se sigue a nadie entre días.</p>} />
      <TintTile icon={Target} tone="ok" label={conversionLabel} value={formatNumber(kpis.conversions)} note={`${formatPercent(kpis.conversion_rate, 2)} de las visitas`} info={<p>Conversiones registradas por el sitio (compras, leads y clics configurados) en el periodo, del agregado diario de visitas.</p>} />
      {showRevenue ? (
        <TintTile icon={Coins} tone="violet" label="Ingresos atribuidos" value={formatMoney(kpis.revenue)} note={`Rebote ${formatPercent(kpis.bounce_rate, 0)}`} info={<p>Valor de las conversiones con monto, en soles, del agregado diario. El rebote es la visita de una sola página sin interacción en 10 segundos.</p>} />
      ) : (
        <TintTile icon={Coins} tone="violet" label="Rebote" value={formatPercent(kpis.bounce_rate, 0)} note={`${secondsLabel(kpis.avg_seconds)} por visita`} info={<p>Visitas de una sola página sin interacción en 10 segundos, sobre el total de visitas del periodo.</p>} />
      )}
    </TileGrid>
  );
}

export function TrendAndLive({ overview }: { overview: WebOverview }) {
  const weekly = overview.trend.length > 31;
  const points = weekly
    ? Array.from({ length: Math.ceil(overview.trend.length / 7) }, (_, index) => overview.trend.slice(index * 7, index * 7 + 7)).map((week) => ({ day: week[0]?.day ?? "", visits: week.reduce((sum, item) => sum + item.visits, 0), visitors: week.reduce((sum, item) => sum + item.visitors, 0) }))
    : overview.trend;
  const live = overview.realtime;

  return (
    <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)]">
      <section className="lift rounded-card border border-line bg-surface p-4">
        <header className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[14.5px] font-semibold">{weekly ? "Visitas por semana" : "Visitas por día"}</h3>
          <span className="text-[12.5px] text-fg-3">{secondsLabel(overview.kpis.avg_seconds)} por visita</span>
        </header>
        <BarChart height={150} data={points.map((point) => ({ label: point.day, value: point.visits, caption: `${point.day.slice(8, 10)}/${point.day.slice(5, 7)}`, detail: `${point.day.slice(8, 10)}/${point.day.slice(5, 7)} · ${formatNumber(point.visits)} visitas · ${formatNumber(point.visitors)} visitantes` }))} />
      </section>
      <section className="lift rounded-card border border-line bg-surface p-4">
        <h3 className="mb-2 flex items-center gap-2 text-[14.5px] font-semibold">
          <Radio size={15} className="text-ok motion-safe:animate-pulse" /> En vivo
        </h3>
        <p className="flex items-baseline gap-2">
          <b className="text-[34px] leading-none tabular-nums">{live.visitors}</b>
          <span className="text-[12.5px] text-fg-3">visitantes en los últimos {live.window_minutes} min</span>
        </p>
        <ul className="mt-3 flex flex-col gap-1.5">
          {live.pages.length === 0 && <li className="text-[12.5px] text-fg-3">Nadie navega el sitio en este momento.</li>}
          {live.pages.map((page) => (
            <li key={page.path} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="truncate font-mono text-[12px]">{page.path}</span>
              <b className="tabular-nums">{page.visitors}</b>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ShareRow({ label, sub, value, total, note }: { label: string; sub?: string; value: number; total: number; note?: string }) {
  const share = total > 0 ? (value / total) * 100 : 0;
  return (
    <li className="group">
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="min-w-0 truncate">
          <b className="font-semibold">{label}</b>
          {sub && <span className="ml-1 text-fg-3">{sub}</span>}
        </span>
        <span className="flex-none tabular-nums text-fg-2">
          {formatNumber(value)} <span className="text-fg-3">· {formatPercent(share, 0)}</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full origin-left rounded-full bg-accent transition-[filter] duration-200 group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.2,0.8,0.2,1)_backwards]" style={{ width: `${Math.max(2, share)}%` }} />
      </div>
      {note && <span className="text-[11.5px] text-fg-3">{note}</span>}
    </li>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="lift rounded-card border border-line bg-surface p-4">
      <h3 className="text-[14.5px] font-semibold">{title}</h3>
      {sub && <p className="mb-3 text-[12.5px] text-fg-3">{sub}</p>}
      <ul className={cn("flex flex-col gap-2.5", !sub && "mt-3")}>{children}</ul>
    </section>
  );
}

export function VisitBreakdown({ pages, sources, devices }: { pages: WebPage[]; sources: WebSource[]; devices: WebDevices }) {
  const totalViews = pages.reduce((sum, page) => sum + page.pageviews, 0);
  const totalVisits = sources.reduce((sum, source) => sum + source.visits, 0);
  const deviceVisits = devices.devices.reduce((sum, item) => sum + item.visits, 0);
  const countryVisits = devices.countries.reduce((sum, item) => sum + item.visits, 0);

  return (
    <>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Páginas más vistas" sub="Vistas, rebote y conversiones por página">
          {pages.length === 0 && <li className="text-[13px] text-fg-3">Sin visitas en el periodo.</li>}
          {pages.slice(0, 8).map((page) => (
            <ShareRow key={page.path} label={page.path} value={page.pageviews} total={totalViews} note={`Rebote ${formatPercent(page.bounce_rate, 0)} · ${page.conversions} conversiones`} />
          ))}
        </Panel>
        <Panel title="Fuentes y campañas" sub="UTM, gclid (Google Ads), fbclid (Meta), ttclid (TikTok) o referente">
          {sources.length === 0 && <li className="text-[13px] text-fg-3">Sin visitas en el periodo.</li>}
          {sources.slice(0, 8).map((source) => (
            <ShareRow key={`${source.source}-${source.medium}-${source.campaign ?? ""}`} label={source.source} sub={`/ ${source.medium}${source.campaign ? ` · ${source.campaign}` : ""}`} value={source.visits} total={totalVisits} />
          ))}
        </Panel>
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Panel title="Dispositivos">
          {devices.devices.map((device) => (
            <ShareRow key={device.device} label={device.label} value={device.visits} total={deviceVisits} />
          ))}
        </Panel>
        <Panel title="Países">
          {devices.countries.slice(0, 7).map((country) => (
            <ShareRow key={country.country} label={COUNTRY[country.country] ?? country.country} value={country.visits} total={countryVisits} />
          ))}
        </Panel>
      </div>
    </>
  );
}
