"use client";

import { AlertTriangle, Award, Coins, Crosshair, Medal, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column } from "@/components/table/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatMoney, formatPercent } from "@/lib/format";
import { HEALTH, type SalesTarget, type TargetsOverview } from "@/lib/targets";
import { toneStyle } from "@/lib/tone";
import { PeriodPicker, ProgressBar, TargetAdjustAction, TargetDetailAction, TargetVoidAction } from "./TargetForms";

function Actions({ target, overview }: { target: SalesTarget; overview: TargetsOverview }) {
  return (
    <RowActions>
      <TargetDetailAction target={target} manage={overview.can.manage} />
      {overview.can.manage && (
        <>
          <TargetAdjustAction target={target} lockPct={overview.policy.lock_decrease_after_pct} canReduceLate={overview.can.reduce_late} />
          <TargetVoidAction target={target} />
        </>
      )}
    </RowActions>
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
            <p className="truncate text-[14px] font-semibold">{target.scope.name}</p>
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
  const groups = inPeriod.filter((target) => target.scope_type !== "asesor");
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
            <b className="block text-[13.5px]">{row.scope.name}</b>
            <span className="text-[12px] text-fg-3">{row.scope_label} · {row.code}</span>
          </span>
        </span>
      ),
    },
    { id: "goal", header: "Meta", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatMoney(row.goals.sales)}</span> },
    { id: "real", header: "Real", align: "right", cell: (row) => <span className="font-mono text-[13px] font-semibold">{formatMoney(row.actual.sales)}</span> },
    { id: "progress", header: "Avance", cell: (row) => <div className="w-[160px]"><ProgressBar progress={row.progress_pct} projection={row.projection_pct} /><span className="mt-1 block text-[11.5px] text-fg-3">{formatPercent(row.progress_pct, 0)} · proyección {formatPercent(row.projection_pct, 0)}</span></div> },
    { id: "health", header: "Estado", cell: (row) => <Badge tone={(HEALTH[row.health] ?? HEALTH.borrador).tone}>{(HEALTH[row.health] ?? HEALTH.borrador).label}</Badge> },
    { id: "actions", header: "", align: "right", mobile: "hidden", cell: (row) => <Actions target={row} overview={overview} /> },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <PeriodPicker periods={overview.periods} value={period} onChange={setPeriod} />
        <p className="text-[12.5px] text-fg-3">Ventas = reservas confirmadas creadas en el período, en soles con el tipo de cambio de cada reserva.</p>
      </div>
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TintTile icon={Crosshair} tone="t1" label={overview.can.manage ? "Meta de asesores" : "Mi meta"} value={formatMoney(goal)} />
        <TintTile icon={Coins} tone="ok" label="Vendido" value={formatMoney(real)} note={goal > 0 ? `${formatPercent((real / goal) * 100, 0)} de la meta` : undefined} />
        <TintTile icon={TrendingUp} tone="violet" label="Proyección al cierre" value={formatMoney(projection)} note="Incluye oportunidades ponderadas" />
        <TintTile icon={AlertTriangle} tone="bad" label="En riesgo" value={risk} note="Proyección bajo el 100 %" />
        <TintTile icon={Award} tone="sun" label="Bonos estimados" value={formatMoney(bonus)} />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {advisors.length === 0 ? (
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
          )}
          <p className="mt-3 text-[11.5px] text-fg-3">Bono por tramos: {overview.policy.tiers.map((tier) => `≥ ${tier.min} % paga ${tier.pay} %`).join(" · ")}.</p>
        </Card>
      </section>

      {overview.can.manage && (
        <Card>
          <TintCardTitle icon={Users} title="Metas de equipo y sede" aside={`${groups.length} en el período`} />
          <DataTable screen="metas-grupos" rows={groups} columns={columns} getKey={(row) => row.code} entityLabel="metas" searchText={(row) => `${row.scope.name} ${row.code}`} searchPlaceholder="Buscar equipo o sede" emptyTitle="Sin metas de equipo o sede en este período" />
        </Card>
      )}
    </>
  );
}
