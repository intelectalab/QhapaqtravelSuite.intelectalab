"use client";

import { ArrowDownRight, ArrowUpRight, Ban, CalendarClock, CircleAlert, CirclePause, CirclePlay, CreditCard, Layers, LogOut, Rocket, Sparkles, TrendingUp, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/Charts";
import { KpiTile } from "@/components/ui/KpiTile";
import { TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { planTone } from "@/lib/platform";
import { monthLabel, type BillingOverview as Overview, type LifecycleEvent, type MetricsPoint } from "@/lib/platformBilling";
import type { Tone } from "@/lib/tone";

const EVENTS: Record<string, { label: string; tone: Tone; icon: LucideIcon }> = {
  alta: { label: "Alta", tone: "ok", icon: Rocket },
  baja: { label: "Baja", tone: "bad", icon: LogOut },
  suspender: { label: "Suspensión", tone: "bad", icon: CirclePause },
  reactivar: { label: "Reactivación", tone: "ok", icon: CirclePlay },
  cambio_plan: { label: "Cambio de plan", tone: "t1", icon: Layers },
  extender_trial: { label: "Prueba extendida", tone: "info", icon: CalendarClock },
  convertir_trial: { label: "Prueba convertida", tone: "violet", icon: Sparkles },
  cobro_rechazado: { label: "Cobro rechazado", tone: "warn", icon: CreditCard },
};

export function BillingKpis({ overview }: { overview: Overview }) {
  const trend = overview.series.map((point) => point.mrr);
  const labels = overview.series.map((point) => `${monthLabel(point.month)} · ${formatMoney(point.mrr)}`);
  const change = overview.mrr_change;

  return (
    <section aria-label="Indicadores" className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <KpiTile
        tone="t1"
        label="Ingreso recurrente mensual"
        value={formatMoney(overview.mrr)}
        note={
          change === null ? `${overview.paying_tenants} agencias que pagan` : (
            <span className="inline-flex items-center gap-1">
              {change >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {formatPercent(Math.abs(change))} frente al mes anterior
            </span>
          )
        }
        trend={trend}
        trendLabels={labels}
      />
      <KpiTile tone="t3" label="Ingreso anualizado" value={formatMoney(overview.arr)} note="Ingreso mensual por 12" />
      <KpiTile tone="t4" label="Ingreso por agencia" value={formatMoney(overview.arpa)} note={`Promedio de ${overview.paying_tenants} agencias que pagan`} />
      <KpiTile tone="t2" label="Bajas en 90 días" value={overview.churn.logo_pct === null ? "—" : formatPercent(overview.churn.logo_pct)} note={`${overview.churn.churned} ${overview.churn.churned === 1 ? "agencia" : "agencias"} · ${formatMoney(overview.churn.lost_mrr)} al mes`} />
      <Link href="/plataforma/facturacion/cobranza" className="rounded-tile focus-visible:outline-2">
        <TintTile
          variant="bento"
          icon={CircleAlert}
          tone={overview.failed.count > 0 ? "bad" : "ok"}
          label="Cobros fallidos"
          value={formatMoney(overview.failed.amount)}
          note={overview.failed.count === 0 ? "Sin deuda pendiente" : `${overview.failed.count} ${overview.failed.count === 1 ? "factura" : "facturas"} · ${overview.failed.in_dunning} en reintento`}
        />
      </Link>
    </section>
  );
}

export function MrrEvolution({ series }: { series: MetricsPoint[] }) {
  const last = series.length - 1;
  return (
    <Card>
      <TintCardTitle icon={TrendingUp} title="Evolución del ingreso mensual" aside="Últimos 6 meses" tone="t1" />
      <BarChart
        height={150}
        data={series.map((point, index) => ({
          label: monthLabel(point.month),
          value: point.mrr,
          caption: formatMoney(point.mrr, "PEN", { compact: true }),
          detail: `${formatMoney(point.mrr)} · ${point.active} ${point.active === 1 ? "agencia" : "agencias"}${index === last ? " · en curso" : ""}`,
          highlight: index === last,
        }))}
      />
    </Card>
  );
}

export function GrowthFlow({ series }: { series: MetricsPoint[] }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...series.map((point) => Math.max(point.new, point.churned + point.suspended)));
  const totals = series.reduce((sum, point) => ({ new: sum.new + point.new, lost: sum.lost + point.churned + point.suspended }), { new: 0, lost: 0 });

  return (
    <Card>
      <TintCardTitle icon={Users} title="Altas y bajas" aside={`${totals.new} altas · ${totals.lost} bajas`} tone="ok" />
      <div className="grid h-[150px] items-end gap-3" style={{ gridTemplateColumns: `repeat(${series.length}, minmax(0, 1fr))` }} onPointerLeave={() => setActive(null)}>
        {series.map((point, index) => {
          const lost = point.churned + point.suspended;
          const isActive = active === point.month;
          return (
            <div key={point.month} className="relative flex h-full cursor-default flex-col items-center justify-end gap-1.5" onPointerEnter={() => setActive(point.month)}>
              {isActive && (
                <span className="pointer-events-none absolute -top-1 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-fg px-2 py-1 text-[11.5px] font-semibold text-bg shadow-lg motion-safe:animate-[drop-in_160ms_ease-out]">
                  {point.new} {point.new === 1 ? "alta" : "altas"} · {point.churned} {point.churned === 1 ? "baja" : "bajas"}
                  {point.suspended > 0 ? ` · ${point.suspended} suspendida` : ""}
                </span>
              )}
              <div className={cn("flex h-[110px] w-full items-end justify-center gap-1 transition-opacity duration-200", active && !isActive && "opacity-45")}>
                <span className="w-[38%] origin-bottom rounded-t-[8px] rounded-b-[3px] bg-ok motion-safe:animate-[grow-up_700ms_cubic-bezier(0.2,0.8,0.2,1)_backwards]" style={{ height: `${Math.max(4, (point.new / max) * 110)}px`, animationDelay: `${index * 70}ms`, opacity: point.new ? 1 : 0.25 }} />
                <span className="w-[38%] origin-bottom rounded-t-[8px] rounded-b-[3px] bg-bad motion-safe:animate-[grow-up_700ms_cubic-bezier(0.2,0.8,0.2,1)_backwards]" style={{ height: `${Math.max(4, (lost / max) * 110)}px`, animationDelay: `${index * 70 + 40}ms`, opacity: lost ? 1 : 0.25 }} />
              </div>
              <span className={cn("font-mono text-[11.5px] text-fg-3", isActive && "text-fg")}>{monthLabel(point.month)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-[12px] text-fg-3">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-ok" />Altas</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-bad" />Bajas y suspensiones</span>
      </div>
    </Card>
  );
}

export function MrrByPlan({ plans, total }: { plans: Overview["by_plan"]; total: number }) {
  return (
    <Card>
      <TintCardTitle icon={Layers} title="Ingreso por plan" aside={formatMoney(total)} tone="violet" />
      <ul className="flex flex-col gap-3">
        {plans.map((plan, index) => (
          <ToneScope key={plan.code} tone={planTone(plan.rank)}>
            <li className="group animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 80}ms` }}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
                <Link href={`/plataforma/planes/${plan.code}`} className="font-semibold hover:underline">
                  {plan.name}
                </Link>
                <span className="text-fg-3">
                  {plan.tenants} {plan.tenants === 1 ? "agencia" : "agencias"} · <b className="font-semibold text-fg">{formatMoney(plan.mrr)}</b>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full origin-left rounded-full bg-[var(--tint)] transition-[filter] duration-300 group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${Math.max(plan.share, plan.mrr > 0 ? 3 : 0)}%`, animationDelay: `${index * 90}ms` }} />
              </div>
              <p className="mt-1 text-right text-[11.5px] text-fg-3">{formatPercent(plan.share)} del total</p>
            </li>
          </ToneScope>
        ))}
      </ul>
    </Card>
  );
}

export function ChurnDetail({ churn }: { churn: Overview["churn"] }) {
  return (
    <Card>
      <TintCardTitle icon={Ban} title="Bajas de los últimos 90 días" aside={churn.revenue_pct === null ? undefined : `${formatPercent(churn.revenue_pct)} del ingreso`} tone="bad" />
      {churn.cancellations.length === 0 ? (
        <p className="text-[13.5px] text-fg-3">Ninguna agencia se dio de baja en los últimos 90 días.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {churn.cancellations.map((item, index) => (
            <li key={`${item.name}-${item.date}`} className="lift flex items-start gap-3 rounded-[12px] bg-[color-mix(in_srgb,var(--bad)_6%,var(--surface))] px-3 py-2.5 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 70}ms` }}>
              <LogOut size={16} className="mt-0.5 flex-none text-bad" />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px] font-semibold">{item.name}</b>
                <span className="block text-[12.5px] text-fg-2">
                  {item.reason}
                  {item.comment ? ` · ${item.comment}` : ""}
                </span>
              </span>
              <span className="text-right text-[12px] text-fg-3">
                <b className="block font-semibold text-bad">−{formatMoney(item.mrr)}</b>
                {item.plan} · {formatDate(item.date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function LifecycleFeed({ events }: { events: LifecycleEvent[] }) {
  return (
    <Card>
      <TintCardTitle icon={CalendarClock} title="Ciclo de vida de las agencias" aside={`${events.length} eventos recientes`} tone="t4" />
      <ol className="relative flex flex-col gap-0.5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
        {events.map((event, index) => {
          const meta = EVENTS[event.kind] ?? { label: event.kind, tone: "t1" as Tone, icon: CalendarClock };
          const Icon = meta.icon;
          const body = (
            <>
              <ToneScope tone={meta.tone}>
                <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[var(--tint)] text-white ring-4 ring-surface transition-transform duration-300 group-hover:scale-110">
                  <Icon size={15} />
                </span>
              </ToneScope>
              <span className="min-w-0 pt-0.5">
                <b className="block truncate text-[13.5px] font-semibold">
                  {meta.label} · {event.tenant}
                </b>
                <span className="block truncate text-[12.5px] text-fg-2">{event.detail}</span>
              </span>
              <span className="pt-0.5 text-right text-xs text-fg-3">
                {formatDateTime(event.at, false)}
                {event.amount !== undefined && <span className={cn("block font-semibold", event.amount < 0 ? "text-bad" : "text-fg-2")}>{formatMoney(Math.abs(event.amount))}</span>}
              </span>
            </>
          );
          const className = "group relative grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-x-3 rounded-[12px] px-1 py-2 transition-colors duration-200 hover:bg-surface-2 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]";
          return (
            <li key={`${event.at}-${event.kind}-${event.tenant}-${index}`} style={event.code ? undefined : { animationDelay: `${index * 50}ms` }} className={event.code ? undefined : className}>
              {event.code ? (
                <Link href={`/plataforma/agencias/${event.code}`} className={className} style={{ animationDelay: `${index * 50}ms` }}>
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
