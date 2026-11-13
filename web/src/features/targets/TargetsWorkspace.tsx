"use client";

import { AlertTriangle, Award, Coins, Crosshair, History, Medal, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import Link from "next/link";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, SortOption } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatMoney, formatPercent } from "@/lib/format";
import { HEALTH, targetHref, type SalesTarget, type TargetsOverview } from "@/lib/targets";
import { toneStyle } from "@/lib/tone";
import { PeriodPicker, ProgressBar, TargetAdjustAction, TargetVoidAction } from "./TargetForms";

function Actions({ target, overview }: { target: SalesTarget; overview: TargetsOverview }) {
  return (
    <RowActions>
      <RowIcon tone="view" label="Ver meta" href={targetHref(target.code)} />
      {overview.can.manage && (
        <>
          <TargetAdjustAction target={target} lockPct={overview.policy.lock_decrease_after_pct} canReduceLate={overview.can.reduce_late} />
          <TargetVoidAction target={target} />
        </>
      )}
    </RowActions>
  );
}

function Indicator({ real, goal, format }: { real: number; goal: number | null; format: (value: number) => string }) {
  return (
    <span className="font-mono text-[13px]" title={goal !== null ? `Meta ${format(goal)}` : "Sin meta"}>
      <span className={cn(goal !== null && real >= goal && "font-semibold text-ok")}>{format(real)}</span>
      {goal !== null && <span className="block text-[11px] text-fg-3">de {format(goal)}</span>}
    </span>
  );
}

function AdvisorCard({ target, overview, index }: { target: SalesTarget; overview: TargetsOverview; index: number }) {
  const health = HEALTH[target.health] ?? HEALTH.borrador;
  const indicators = [
    { label: "Reservas", real: target.actual.bookings, goal: target.goals.bookings, format: (value: number) => String(value) },
    { label: "Margen", real: target.actual.margin, goal: target.goals.margin, format: (value: number) => formatMoney(value, "PEN", { compact: true }) },
    { label: "Conversión", real: target.actual.conversion ?? 0, goal: target.goals.conversion, format: (value: number) => formatPercent(value, 0) },
  ];
  return (
    <article style={{ ...toneStyle(health.tone), animationDelay: `${index * 70}ms` }} className="lift animate-[rise-in_460ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-[color-mix(in_srgb,var(--tint)_25%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={target.scope.name} size="md" />
          <div className="min-w-0">
            <Link href={targetHref(target.code)} className="block truncate text-[14px] font-semibold hover:text-accent hover:underline">
              {target.scope.name}
            </Link>
            <p className="text-[12px] text-fg-3">{target.status === "vigente" && target.days_left > 0 ? `${target.days_left} días por delante` : target.period_label}</p>
          </div>
        </div>
        <Badge tone={health.tone}>{health.label}</Badge>
      </header>
      <div className="mt-3.5 flex items-end justify-between gap-2">
        <p className="text-[24px] font-bold leading-none tracking-tight">{formatPercent(target.progress_pct, 0)}</p>
        <p className="text-right text-[12px] text-fg-3">
          {formatMoney(target.actual.sales)} de {formatMoney(target.goals.sales)}
          <span className="block">Proyección {formatPercent(target.projection_pct, 0)}</span>
        </p>
      </div>
      <div className="mt-2.5">
        <ProgressBar progress={target.progress_pct} projection={target.projection_pct} />
      </div>
      <dl className="mt-3.5 grid grid-cols-3 gap-2">
        {indicators.map((item) => (
          <div key={item.label} className="rounded-lg bg-surface/80 px-2.5 py-2 transition-transform duration-200 hover:-translate-y-0.5" title={item.goal !== null ? `Meta ${item.format(item.goal)}` : "Sin meta"}>
            <dt className="text-[11px] text-fg-3">{item.label}</dt>
            <dd className={cn("text-[13.5px] font-bold", item.goal !== null && item.real >= item.goal ? "text-ok" : "")}>{item.format(item.real)}</dd>
          </div>
        ))}
      </dl>
      <footer className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[12px] text-fg-3">{target.bonus ? `Bono estimado ${formatMoney(target.bonus.estimated)} (${target.bonus.pct} %)` : target.code}</span>
        <Actions target={target} overview={overview} />
      </footer>
    </article>
  );
}

export function TargetsWorkspace({ overview }: { overview: TargetsOverview }) {
  const [period, setPeriod] = useState(overview.current_period ?? overview.periods[0]?.value ?? "");
  const inPeriod = useMemo(() => overview.targets.filter((target) => target.period_key === period), [overview.targets, period]);
  const advisors = inPeriod.filter((target) => target.scope_type === "asesor" && target.status !== "anulada");
  const live = advisors.filter((target) => target.status !== "borrador");
  const goal = live.reduce((total, target) => total + target.goals.sales, 0);
  const real = live.reduce((total, target) => total + target.actual.sales, 0);
  const projection = live.reduce((total, target) => total + target.projection, 0);
  const risk = live.filter((target) => target.health === "en_riesgo" || target.health === "critico").length;
  const bonus = live.reduce((total, target) => total + (target.bonus?.estimated ?? 0), 0);

  const columns: Column<SalesTarget>[] = [
    {
      id: "scope",
      header: "Alcance",
      mobile: "title",
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-surface-2 text-fg-2">{row.scope_type === "equipo" ? <Users size={15} /> : <Crosshair size={15} />}</span>
          <span>
            <Link href={targetHref(row.code)} className="block text-[13.5px] font-bold hover:text-accent hover:underline">
              {row.scope.name}
            </Link>
            <span className="text-[12px] text-fg-3">{row.scope_label} · {row.code}</span>
          </span>
        </span>
      ),
    },
    { id: "goal", header: "Meta", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatMoney(row.goals.sales)}</span> },
    { id: "real", header: "Real", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatMoney(row.actual.sales)}</span> },
    { id: "progress", header: "Avance", cell: (row) => <div className="w-[160px]"><ProgressBar progress={row.progress_pct} projection={row.projection_pct} /><span className="mt-1 block text-[11.5px] text-fg-3">{formatPercent(row.progress_pct, 0)} · proyección {formatPercent(row.projection_pct, 0)}</span></div> },
    { id: "bookings", header: "Reservas", align: "right", cell: (row) => <Indicator real={row.actual.bookings} goal={row.goals.bookings} format={String} /> },
    { id: "margin", header: "Margen", align: "right", cell: (row) => <Indicator real={row.actual.margin} goal={row.goals.margin} format={(value) => formatMoney(value, "PEN", { compact: true })} /> },
    { id: "conversion", header: "Conversión", align: "right", cell: (row) => <Indicator real={row.actual.conversion ?? 0} goal={row.goals.conversion} format={(value) => formatPercent(value, 0)} /> },
    { id: "health", header: "Estado", cell: (row) => <Badge tone={(HEALTH[row.health] ?? HEALTH.borrador).tone}>{(HEALTH[row.health] ?? HEALTH.borrador).label}</Badge> },
    { id: "actions", header: "", align: "right", mobile: "hidden", cell: (row) => <Actions target={row} overview={overview} /> },
  ];
  const tableRows = inPeriod.filter((target) => target.status !== "anulada");
  const filters: FilterConfig<SalesTarget>[] = [
    { id: "scope", label: "Alcance", options: [{ value: "asesor", label: "Asesor" }, { value: "equipo", label: "Equipo" }, { value: "sede", label: "Sede" }], value: (row) => row.scope_type },
    { id: "advisor", label: "Asesor", options: [...new Set(tableRows.filter((row) => row.scope_type === "asesor").map((row) => row.scope.name))].map((name) => ({ value: name, label: name })), value: (row) => (row.scope_type === "asesor" ? row.scope.name : "") },
    { id: "health", label: "Estado", options: [...new Set(tableRows.map((row) => row.health))].map((value) => ({ value, label: (HEALTH[value] ?? HEALTH.borrador).label })), value: (row) => row.health },
  ];
  const sorts: SortOption<SalesTarget>[] = [
    { id: "progress", label: "Avance", type: "number", value: (row) => row.progress_pct },
    { id: "projection", label: "Proyección", type: "number", value: (row) => row.projection_pct },
    { id: "sales", label: "Vendido", type: "number", value: (row) => row.actual.sales },
  ];
  const history = overview.targets
    .filter((target) => target.period_key !== period && (target.status === "cerrada" || target.health === "por_cerrar"))
    .sort((a, b) => b.period_from.localeCompare(a.period_from))
    .slice(0, 8);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker periods={overview.periods} value={period} onChange={setPeriod} />
      </div>
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TintTile icon={Crosshair} tone="t1" label={overview.can.manage ? "Meta de asesores" : "Mi meta"} value={formatMoney(goal)} info={<p>Suma de la meta de ventas de las metas de asesor activas o cerradas del período elegido. No incluye borradores.</p>} />
        <TintTile icon={Coins} tone="ok" label="Vendido" value={formatMoney(real)} note={goal > 0 ? `${formatPercent((real / goal) * 100, 0)} de la meta` : undefined} info={<p>Reservas confirmadas creadas en el período por esos asesores, en soles con el tipo de cambio de cada reserva.</p>} />
        <TintTile icon={TrendingUp} tone="violet" label="Proyección al cierre" value={formatMoney(projection)} note="Incluye oportunidades ponderadas" info={<p>Lo vendido más las oportunidades abiertas que cierran en el período, multiplicadas por su probabilidad.</p>} />
        <TintTile icon={AlertTriangle} tone="bad" label="En riesgo" value={risk} note="Proyección bajo el 100 %" info={<p>Metas de asesor cuya proyección no alcanza la meta: en riesgo desde el 80 %, crítico por debajo.</p>} />
        <TintTile icon={Award} tone="sun" label="Bonos estimados" value={formatMoney(bonus)} info={<p>Bono base de cada meta por el tramo que alcanza su proyección: {overview.policy.tiers.map((tier) => `${tier.min} % paga ${tier.pay} %`).join(", ")}.</p>} />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {overview.can.manage ? (
            <Card padded={false} className="overflow-hidden">
              <DataTable screen="metas-periodo" rows={tableRows} columns={columns} getKey={(row) => row.code} entityLabel="metas" searchText={(row) => `${row.scope.name} ${row.code} ${row.scope_label}`} searchPlaceholder="Buscar asesor, equipo o sede" filters={filters} sorts={sorts} emptyTitle="Sin metas en este período" />
            </Card>
          ) : advisors.length === 0 ? (
            <Card>
              <EmptyState icon={<Crosshair size={20} />} title="Sin metas de asesor en este período" description={overview.can.manage ? "Crea una meta para empezar a medir el avance." : "Cuando Gerencia active tu meta la verás aquí."} />
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {advisors.map((target, index) => (
                <AdvisorCard key={target.code} target={target} overview={overview} index={index} />
              ))}
            </div>
          )}
        </div>
        <Card>
          <TintCardTitle icon={Medal} title="Ranking del mes" tone="sun" />
          {overview.ranking.length === 0 ? (
            <p className="text-[13px] text-fg-3">Aún no hay metas vigentes para comparar.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {overview.ranking.map((entry) => (
                <li key={entry.name} className={cn("lift flex items-center gap-3 rounded-xl border px-3 py-2.5", entry.me ? "border-accent/40 bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))]" : "border-line")}>
                  <span className={cn("grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold", entry.position === 1 ? "bg-t2 text-t2-fg" : "bg-surface-2 text-fg-2")}>{entry.position}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13px]">{entry.name}{entry.me ? " (tú)" : ""}</b>
                    {entry.sales !== null && <span className="text-[11.5px] text-fg-3">{formatMoney(entry.sales)} de {formatMoney(entry.goal ?? 0)}</span>}
                  </span>
                  <span className="font-mono text-[13px] font-semibold">{formatPercent(entry.progress_pct, 0)}</span>
                </li>
              ))}
            </ol>
          )}        </Card>
      </section>

      <Card>
        <TintCardTitle icon={History} title={overview.can.manage ? "Metas cerradas y por cerrar" : "Mis metas de otros períodos"} tone="violet" aside={history.length > 0 ? `${history.length} recientes` : undefined} />
        {history.length === 0 ? (
          <p className="text-[13px] text-fg-3">Aún no hay metas de otros períodos.</p>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {history.map((target) => {
              const health = HEALTH[target.health] ?? HEALTH.borrador;
              return (
                <li key={target.code}>
                  <Link href={targetHref(target.code)} style={toneStyle(health.tone)} className="lift block rounded-xl border border-line px-3.5 py-3 hover:border-[var(--tint)]">
                    <span className="flex items-center justify-between gap-2">
                      <b className="truncate text-[13px]">{target.scope.name}</b>
                      <Badge tone={health.tone}>{health.label}</Badge>
                    </span>
                    <span className="mt-0.5 block text-[12px] text-fg-3">{target.period_label} · {target.code}</span>
                    <span className="mt-2 block"><ProgressBar progress={target.progress_pct} projection={target.progress_pct} /></span>
                    <span className="mt-1 block text-[12px] text-fg-2">{formatPercent(target.progress_pct, 0)} · {formatMoney(target.actual.sales)} de {formatMoney(target.goals.sales)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
