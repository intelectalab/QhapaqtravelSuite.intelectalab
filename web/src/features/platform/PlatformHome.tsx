import { ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, Building2, CircleCheck, CirclePause, History, Hourglass, Layers, Users } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Sparkline } from "@/components/ui/Charts";
import { EmptyState } from "@/components/ui/EmptyState";
import { HeroBand, HeroChip, HeroPanel, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { planTone } from "@/lib/platform";
import { actionMeta, monthLabel, type PlatformHomeOverview } from "@/lib/platformBilling";

export function PlatformHomeView({ home }: { home: PlatformHomeOverview }) {
  const change = home.mrr_change;
  const maxPlan = Math.max(1, ...home.plans.map((plan) => plan.tenants));

  return (
    <ToneScope tone="t1">
      <HeroBand>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-[13px] font-medium text-white/70">Ingreso recurrente mensual</p>
            <p className="mt-1 text-[42px] font-bold leading-none tracking-[-0.03em]">{formatMoney(home.mrr)}</p>
            <p className="mt-2 flex items-center gap-1.5 text-[13.5px] text-white/80">
              {change !== null && (change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />)}
              {change !== null ? `${formatPercent(Math.abs(change))} frente al mes anterior` : "Primer mes con registro"} · {formatMoney(home.arr)} al año
            </p>
            <div className="relative mt-4 h-[56px] text-white">
              <Sparkline values={home.series.map((point) => point.mrr)} labels={home.series.map((point) => `${monthLabel(point.month)} · ${formatMoney(point.mrr)}`)} className="relative h-full w-full" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/plataforma/facturacion" className="rounded-full transition hover:brightness-110">
                <HeroChip icon={<ArrowRight size={14} />}>Ver facturación</HeroChip>
              </Link>
              <HeroChip icon={<Users size={14} />}>Ingreso por agencia {formatMoney(home.arpa)}</HeroChip>
            </div>
          </div>
          <HeroPanel>
            <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold">
              <Building2 size={15} />
              {home.tenants.total} agencias en la plataforma
            </p>
            <div className="grid grid-cols-3 gap-2">
              <StatusBlock href="/plataforma/agencias" label="Activas" value={home.tenants.active} icon={<CircleCheck size={16} />} />
              <StatusBlock href="/plataforma/facturacion/trials" label="En prueba" value={home.tenants.trial} icon={<Hourglass size={16} />} />
              <StatusBlock href="/plataforma/agencias" label="Suspendidas" value={home.tenants.suspended} icon={<CirclePause size={16} />} />
            </div>
            <p className="mt-3 text-[12.5px] text-white/70">{home.tenants.users} usuarios activos entre todas las agencias.</p>
          </HeroPanel>
        </div>
      </HeroBand>

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={BellRing} title="Alertas" aside={home.alerts.length ? String(home.alerts.length) : undefined} tone="bad" />
          {home.alerts.length === 0 ? (
            <EmptyState icon={<CircleCheck size={22} />} title="Todo en orden" description="No hay cobros fallidos, pruebas por vencer ni consumos al límite." />
          ) : (
            <ul className="flex flex-col gap-2">
              {home.alerts.map((alert, index) => (
                <ToneScope key={`${alert.kind}-${alert.title}`} tone={alert.tone}>
                  <li className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 50}ms` }}>
                    <Link href={alert.href} className="group flex items-center gap-3 rounded-[12px] border border-[color-mix(in_srgb,var(--tint)_20%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] px-3 py-2.5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]">
                      <span className="h-8 w-1.5 flex-none rounded-full bg-[var(--tint)]" />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13.5px] font-semibold">{alert.title}</b>
                        <span className="block truncate text-[12.5px] text-fg-2">{alert.detail}</span>
                      </span>
                      <ArrowRight size={16} className="flex-none text-fg-3 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-[var(--tint)]" />
                    </Link>
                  </li>
                </ToneScope>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Link href="/plataforma/facturacion/cobranza" className="rounded-tile">
            <TintTile variant="side" icon={CirclePause} tone={home.failed.count ? "bad" : "ok"} label="Cobros fallidos" value={formatMoney(home.failed.amount)} note={home.failed.count ? `${home.failed.count} facturas de ${home.failed.tenants} ${home.failed.tenants === 1 ? "agencia" : "agencias"}` : "Ninguna agencia con deuda"} />
          </Link>
          <Card>
            <TintCardTitle icon={Layers} title="Agencias por plan" tone="violet" />
            <ul className="flex flex-col gap-3">
              {home.plans.map((plan, index) => (
                <ToneScope key={plan.code} tone={planTone(plan.rank)}>
                  <li>
                    <Link href={`/plataforma/planes/${plan.code}`} className="group block">
                      <span className="mb-1 flex justify-between text-[13px]">
                        <b className="font-semibold group-hover:underline">{plan.name}</b>
                        <span className="text-fg-3">{plan.tenants}</span>
                      </span>
                      <span className="block h-2 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full origin-left rounded-full bg-[var(--tint)] transition-[filter] duration-300 group-hover:brightness-110 motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${Math.max(4, (plan.tenants / maxPlan) * 100)}%`, animationDelay: `${index * 90}ms` }} />
                      </span>
                    </Link>
                  </li>
                </ToneScope>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      <Card>
        <TintCardTitle icon={History} title="Actividad reciente" aside={<Link href="/plataforma/auditoria" className="hover:underline">Ver auditoría</Link>} tone="t4" />
        <ol className="relative flex flex-col gap-0.5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-line">
          {home.activity.map((event, index) => {
            const meta = actionMeta(event.action);
            return (
              <li key={event.id} className="group relative grid grid-cols-[32px_minmax(0,1fr)_auto] items-start gap-x-3 rounded-[12px] px-1 py-2 transition-colors hover:bg-surface-2 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 50}ms` }}>
                <ToneScope tone={meta.tone}>
                  <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[var(--tint)] ring-4 ring-surface transition-transform duration-300 group-hover:scale-110">
                    <span className="h-2 w-2 rounded-full bg-white" />
                  </span>
                </ToneScope>
                <span className="min-w-0 pt-0.5">
                  <b className="block truncate text-[13.5px] font-semibold">
                    {meta.label} · {event.subject}
                  </b>
                  <span className="block truncate text-[12.5px] text-fg-2">{event.after ?? event.entity}</span>
                </span>
                <span className="pt-0.5 text-right text-xs text-fg-3">
                  {formatDateTime(event.at, false)}
                  <span className="block">{event.actor ?? "Sistema"}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </Card>
    </ToneScope>
  );
}

function StatusBlock({ href, label, value, icon }: { href: string; label: string; value: number; icon: React.ReactNode }) {
  return (
    <Link href={href} className="group rounded-[12px] bg-white/10 px-3 py-2.5 ring-1 ring-white/15 transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-white/20">
      <span className="flex items-center gap-1.5 text-[12px] text-white/75">
        <span className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110">{icon}</span>
        {label}
      </span>
      <b className="mt-1 block text-[26px] font-bold leading-none">{value}</b>
    </Link>
  );
}
