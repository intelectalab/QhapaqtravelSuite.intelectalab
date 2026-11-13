"use client";

import { CalendarSearch, Layers, Scale } from "lucide-react";
import { useState, useTransition } from "react";
import { resolveSeason } from "@/app/(backoffice)/catalogo/tarifas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { daysBetween, SEASON_PHASE, SEASON_TONE, type RatesOverview, type SeasonResolution, type SeasonRow } from "@/lib/catalog-rates";
import { cn } from "@/lib/cn";
import { formatDate, monthName } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { SeasonDeleteAction, SeasonEditAction, SeasonToggleAction } from "./RateForms";

const factorLabel = (factor: number) => (factor === 1 ? "precio base" : `${factor > 1 ? "+" : ""}${Math.round((factor - 1) * 100)} %`);

function Timeline({ seasons, today }: { seasons: SeasonRow[]; today: string }) {
  const [hover, setHover] = useState<string | null>(null);
  if (seasons.length === 0) return null;
  const start = `${seasons.reduce((min, season) => (season.date_from < min ? season.date_from : min), seasons[0].date_from).slice(0, 7)}-01`;
  const lastEnd = seasons.reduce((max, season) => (season.date_to > max ? season.date_to : max), seasons[0].date_to);
  const endDate = new Date(`${lastEnd.slice(0, 7)}-01T00:00:00Z`);
  endDate.setUTCMonth(endDate.getUTCMonth() + 1);
  const end = endDate.toISOString().slice(0, 10);
  const span = Math.max(1, daysBetween(start, end));
  const at = (date: string) => (Math.min(span, Math.max(0, daysBetween(start, date))) / span) * 100;
  const months: string[] = [];
  for (const cursor = new Date(`${start}T00:00:00Z`); cursor.toISOString().slice(0, 10) < end; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) months.push(cursor.toISOString().slice(0, 10));
  const rows = [...seasons].sort((a, b) => a.priority - b.priority || a.date_from.localeCompare(b.date_from));
  const showToday = today >= start && today <= end;

  return (
    <div className="scroll-thin overflow-x-auto">
      <div className="relative min-w-[680px]">
        <div className="relative ml-[168px] flex h-7 border-b border-line text-[11.5px] text-fg-3">
          {months.map((month) => (
            <span key={month} className="absolute top-1 -translate-x-0 pl-1.5 capitalize" style={{ left: `${at(month)}%` }}>
              {monthName(month).slice(0, 3)}
              {month.slice(5, 7) === "01" && <b className="ml-1 font-semibold text-fg-2">{month.slice(0, 4)}</b>}
            </span>
          ))}
        </div>
        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[168px] right-0">
            {months.map((month) => (
              <span key={month} className="absolute inset-y-0 border-l border-dashed border-line-2" style={{ left: `${at(month)}%` }} />
            ))}
            {showToday && (
              <span className="absolute inset-y-0 z-10 w-0.5 bg-brand" style={{ left: `${at(today)}%` }}>
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-brand px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-fg">hoy</span>
              </span>
            )}
          </div>
          {rows.map((season, index) => {
            const left = at(season.date_from);
            const width = Math.max(1.2, at(season.date_to) + 100 / span - left);
            const active = hover === season.ref;
            return (
              <div key={season.ref} style={{ ...toneStyle(SEASON_TONE[season.type] ?? "t1"), animationDelay: `${index * 60}ms` }} className="relative flex h-11 items-center motion-safe:animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" onPointerEnter={() => setHover(season.ref)} onPointerLeave={() => setHover(null)}>
                <span className={cn("w-[168px] flex-none truncate pr-3 text-[12.5px] transition-colors", active ? "font-semibold text-fg" : "text-fg-2", season.status === "inactiva" && "line-through opacity-60")}>{season.name}</span>
                <span className="relative h-full flex-1">
                  <span
                    className={cn(
                      "absolute top-1/2 flex h-6 -translate-y-1/2 origin-left items-center overflow-hidden rounded-lg px-2 text-[11px] font-semibold text-white shadow-[0_6px_14px_-8px_var(--tint)] transition-[transform,filter] duration-200 motion-safe:animate-[fill-x_640ms_cubic-bezier(0.22,1,0.36,1)_backwards]",
                      season.status === "inactiva" ? "bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--tint)_45%,transparent)_0_6px,color-mix(in_srgb,var(--tint)_25%,transparent)_6px_12px)]" : "bg-[var(--tint)]",
                      active && "z-20 scale-y-110 brightness-110",
                    )}
                    style={{ left: `${left}%`, width: `${width}%`, animationDelay: `${120 + index * 60}ms` }}
                  >
                    <span className="truncate">×{season.factor.toFixed(2)}</span>
                  </span>
                  {active && (
                    <span className="pointer-events-none absolute bottom-full z-30 mb-0.5 whitespace-nowrap rounded-lg bg-fg px-2.5 py-1.5 text-[11.5px] font-medium text-bg shadow-lg motion-safe:animate-[drop-in_160ms_ease-out]" style={{ left: `${Math.min(left, 70)}%` }}>
                      {formatDate(season.date_from)} – {formatDate(season.date_to)} · prioridad {season.priority} · {factorLabel(season.factor)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Overlaps({ overview }: { overview: RatesOverview }) {
  const byRef = new Map(overview.seasons.map((season) => [season.ref, season]));
  if (overview.overlaps.length === 0) return null;
  return (
    <div className="mt-5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
      {overview.overlaps.map((pair, index) => {
        const winner = byRef.get(pair.winner);
        const loser = byRef.get(pair.winner === pair.a ? pair.b : pair.a);
        return (
          <article key={`${pair.a}-${pair.b}`} style={{ ...toneStyle(SEASON_TONE[winner?.type ?? ""] ?? "t1"), animationDelay: `${index * 70}ms` }} className="lift group rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] px-4 py-3 motion-safe:animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--tint)]">
              <Scale size={14} className="transition-transform duration-300 group-hover:-rotate-12" />
              {formatDate(pair.from)} – {formatDate(pair.to)}
            </p>
            <p className="mt-1 text-[13px]">
              Manda <b className="font-semibold">{winner?.name}</b>
              <span className="text-fg-3"> sobre {loser?.name}</span>
            </p>
          </article>
        );
      })}
    </div>
  );
}

function SeasonResolver({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<SeasonResolution | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const resolve = () =>
    startTransition(async () => {
      const response = await resolveSeason(date);
      setResult(response.data);
      setMessage(response.message);
    });
  const season = result?.season ?? null;
  return (
    <section className="lift rounded-tile border border-line bg-surface px-4 py-3.5">
      <div className="flex flex-wrap items-end gap-3">
        <TextField className="w-48" label="Resolver temporada por fecha" name="resolve_date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        <Button type="button" variant="secondary" onClick={resolve} disabled={pending || !date}>
          <CalendarSearch size={16} /> {pending ? "Resolviendo" : "Resolver"}
        </Button>
        {result && (
          <div className="min-w-0 flex-1 text-[13px] motion-safe:animate-[rise-in_320ms_ease-out]">
            {season ? (
              <p style={toneStyle(SEASON_TONE[season.type] ?? "t1")}>
                El {formatDate(result.date)} aplica <b className="font-semibold text-[var(--tint)]">{season.name}</b>
                <span className="text-fg-3"> · prioridad {season.priority} · {factorLabel(result.factor)}</span>
              </p>
            ) : (
              <p>El {formatDate(result.date)} no lo cubre ninguna temporada activa: se usa el precio base.</p>
            )}
            {result.others.length > 0 && <p className="text-[12px] text-fg-3">También la cubren, con menos peso: {result.others.map((other) => `${other.name} (prioridad ${other.priority})`).join(", ")}.</p>}
          </div>
        )}
        {message && <p className="text-[13px] text-bad">{message}</p>}
      </div>
    </section>
  );
}

export function SeasonsBoard({ overview }: { overview: RatesOverview }) {
  const columns: Column<SeasonRow>[] = [
    {
      id: "season",
      header: "Temporada",
      mobile: "title",
      cell: (season) => (
        <span className="flex min-w-0 items-center gap-2.5" style={toneStyle(SEASON_TONE[season.type] ?? "t1")}>
          <span className="h-8 w-1.5 flex-none rounded-full bg-[var(--tint)]" />
          <span className="min-w-0">
            <b className="block truncate font-semibold">{season.name}</b>
            <small className="block text-xs text-fg-3">{season.ref} · {season.type}</small>
          </span>
        </span>
      ),
    },
    { id: "dates", header: "Fechas", cell: (season) => <span className="text-[13px]">{formatDate(season.date_from)} – {formatDate(season.date_to)}<small className="block text-xs text-fg-3">{SEASON_PHASE[season.phase]}</small></span> },
    { id: "priority", header: "Prioridad", align: "right", cell: (season) => <span className="font-mono text-[13px] font-semibold">{season.priority}</span> },
    { id: "factor", header: "Factor", align: "right", cell: (season) => <span className={cn("font-mono text-[13px] font-semibold", season.factor > 1 ? "text-bad" : season.factor < 1 ? "text-ok" : "text-fg-2")} title={factorLabel(season.factor)}>×{season.factor.toFixed(2)}</span> },
    { id: "usage", header: "En uso", wideOnly: true, cell: (season) => <span className="text-[13px] text-fg-2">{season.rates} tarifas · {season.products} productos</span> },
    { id: "status", header: "Estado", cell: (season) => <Badge tone={season.status === "activa" ? "ok" : "mute"}>{season.status === "activa" ? "Activa" : "Inactiva"}</Badge> },
    ...(overview.can.manage
      ? [
          {
            id: "actions",
            header: "",
            mobile: "hidden" as const,
            align: "right" as const,
            cell: (season: SeasonRow) => (
              <RowActions>
                <SeasonEditAction overview={overview} season={season} />
                <SeasonToggleAction season={season} />
                <SeasonDeleteAction season={season} />
              </RowActions>
            ),
          },
        ]
      : []),
  ];
  const metrics: MetricFilter<SeasonRow>[] = [
    { id: "now", label: "En curso", tone: "ok", icon: <Layers size={19} />, matches: (season) => season.phase === "en_curso" && season.status === "activa" },
    { id: "next", label: "Próximas", tone: "info", icon: <Layers size={19} />, matches: (season) => season.phase === "proxima" && season.status === "activa" },
    { id: "off", label: "Inactivas", tone: "mute", icon: <Layers size={19} />, matches: (season) => season.status === "inactiva" },
  ];
  const filters: FilterConfig<SeasonRow>[] = [{ id: "type", label: "Tipo", options: [...new Set(overview.seasons.map((season) => season.type))].map((value) => ({ value, label: value })), value: (season) => season.type }];

  return (
    <div className="flex flex-col gap-6">
      <section>
        <Timeline seasons={overview.seasons} today={overview.today} />
        <Overlaps overview={overview} />
      </section>
      <SeasonResolver today={overview.today} />
      <DataTable screen="temporadas" rows={overview.seasons} columns={columns} getKey={(season) => season.ref} entityLabel="temporadas" searchText={(season) => `${season.ref} ${season.name} ${season.type}`} searchPlaceholder="Buscar temporada" metrics={metrics} filters={filters} csv={{ fileName: "temporadas", columns: [{ header: "Código", value: (season) => season.ref }, { header: "Temporada", value: (season) => season.name }, { header: "Tipo", value: (season) => season.type }, { header: "Desde", value: (season) => season.date_from }, { header: "Hasta", value: (season) => season.date_to }, { header: "Prioridad", value: (season) => season.priority }, { header: "Factor", value: (season) => season.factor }, { header: "Tarifas que la usan", value: (season) => season.rates }, { header: "Productos", value: (season) => season.products }, { header: "Estado", value: (season) => (season.status === "activa" ? "Activa" : "Inactiva") }] }} />
    </div>
  );
}
