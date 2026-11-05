import { ArrowRight, Clock, FileText, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ActionList, type ActionListItem } from "@/components/ui/ActionList";
import { StatusBadge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/Charts";
import { EmptyState } from "@/components/ui/EmptyState";
import { KpiTile } from "@/components/ui/KpiTile";
import type { AttentionKind, HomeDashboard } from "@/lib/dashboard";
import { capitalize, formatDate, formatMoney, formatPercent } from "@/lib/format";
import { getHomeDashboard } from "@/lib/server/dashboard";
import { currentUser } from "@/lib/server/me";
import type { Tone } from "@/lib/tone";

export const metadata: Metadata = { title: "Panel de control" };

const ATTENTION_LOOK: Record<AttentionKind, { tone: Tone; icon: ReactNode }> = {
  incident: { tone: "bad", icon: <TriangleAlert size={17} strokeWidth={2} /> },
  collection: { tone: "warn", icon: <Clock size={17} strokeWidth={2} /> },
  quote: { tone: "accent", icon: <FileText size={17} strokeWidth={2} /> },
};

function LinkArrow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
      {children}
      <ArrowRight size={14} strokeWidth={2.2} />
    </Link>
  );
}

function salesNote(kpis: HomeDashboard["kpis"]): string {
  if (!kpis.previous_month) return "Primer mes con ventas";
  if (kpis.sales_previous === 0) return `Sin ventas en ${kpis.previous_month.toLowerCase()}`;
  const delta = ((kpis.sales - kpis.sales_previous) / kpis.sales_previous) * 100;
  return `${delta >= 0 ? "+" : "−"}${formatPercent(Math.abs(delta))} frente a ${kpis.previous_month.toLowerCase()}`;
}

function marginNote(kpis: HomeDashboard["kpis"]): string {
  if (kpis.margin_previous === null) return "Sin mes anterior para comparar";
  return `${formatPercent(kpis.margin_previous)} en ${kpis.previous_month?.toLowerCase() ?? "el mes anterior"}`;
}

function attentionTitle(item: HomeDashboard["attention"][number]): string {
  return item.amount ? `${item.title} por ${formatMoney(item.amount)}` : item.title;
}

export default async function InicioPage() {
  const [me, home] = await Promise.all([currentUser(), getHomeDashboard()]);
  const { kpis } = home;
  const attention: ActionListItem[] = home.attention.map((item, index) => ({ id: `${item.kind}-${index}`, ...ATTENTION_LOOK[item.kind], ...item, title: attentionTitle(item) }));
  const firstName = me.name.split(" ")[0];
  const pending = attention.length;
  const hasSales = home.months.some((month) => month.sales > 0);

  return (
    <>
      <div className="mb-5 mt-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[32px] font-bold leading-[1.08] tracking-[-0.04em] sm:text-[38px]">
          Hola, {firstName}
          <span className="text-brand">.</span>
          <br />
          <span className="font-semibold text-fg-3">{pending === 0 ? "Todo está al día." : `Tienes ${pending} ${pending === 1 ? "cosa" : "cosas"} por resolver hoy.`}</span>
        </h1>
        <p className="text-right text-[13px] text-fg-3">
          <b className="mb-0.5 block font-mono text-[13px] font-semibold tracking-wide text-fg">{capitalize(formatDate(home.today, "long"))}</b>
          {me.tenant.name}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile tone="t1" label="Ventas del mes" value={formatMoney(kpis.sales, "PEN", { compact: true })} note={salesNote(kpis)} trend={hasSales ? home.months.map((month) => month.sales) : undefined} trendLabels={home.months.map((month) => `${capitalize(month.label)} · ${formatMoney(month.sales, "PEN", { compact: true })}`)} />
        <KpiTile tone="t2" label="Margen bruto" value={kpis.margin === null ? "—" : formatPercent(kpis.margin)} note={marginNote(kpis)} trend={hasSales ? home.months.map((month) => month.sales - month.cost) : undefined} trendLabels={home.months.map((month) => `${capitalize(month.label)} · ${formatMoney(month.sales - month.cost, "PEN", { compact: true })}`)} />
        <KpiTile tone="t3" label="Por cobrar" value={formatMoney(kpis.receivable, "PEN", { compact: true })} note={kpis.overdue > 0 ? `${formatMoney(kpis.overdue)} vencidos` : "Nada vencido"} />
        <KpiTile tone="t4" label="Reservas activas" value={kpis.active_reservations} note={`${kpis.passengers} ${kpis.passengers === 1 ? "pasajero" : "pasajeros"}`} />
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader title="Por resolver" action={<span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] font-semibold text-fg-2">{pending}</span>} />
          {pending === 0 ? <p className="py-6 text-center text-[13px] text-fg-3">No hay incidencias, cobros vencidos ni cotizaciones por vencer.</p> : <ActionList items={attention} />}
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader title="Próximas salidas" action={<LinkArrow href="/reservas">Ver reservas</LinkArrow>} />
          {home.departures.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-fg-3">No hay salidas programadas.</p>
          ) : (
            <ul>
              {home.departures.map((departure) => (
                <li key={departure.code} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                  <span className="font-mono text-[13px] font-semibold uppercase">{formatDate(departure.date).replace(/ \d{4}$/, "")}</span>
                  <span className="min-w-0">
                    <Link href={`/reservas/${departure.code}`} className="block truncate text-[13.5px] font-semibold hover:underline">
                      {departure.title}
                    </Link>
                    <span className="text-xs text-fg-3">
                      {departure.code} · {departure.passengers} {departure.passengers === 1 ? "pasajero" : "pasajeros"}
                    </span>
                  </span>
                  <StatusBadge status={departure.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-12">
          <div className="grid items-end gap-7 md:grid-cols-[230px_1fr]">
            <div>
              <h2 className="text-[15px] font-semibold">Ventas de los últimos 6 meses</h2>
              <p className="mt-1 text-[12.5px] text-fg-3">En miles de soles · el mes actual en curso</p>
              <div className="mt-2.5">
                <LinkArrow href="/reportes">Ver reportes</LinkArrow>
              </div>
            </div>
            {hasSales ? (
              <BarChart
                data={home.months.map((month, index, all) => ({
                  label: month.label,
                  value: month.sales,
                  caption: month.sales > 0 ? String(Math.round(month.sales / 1000)) : "0",
                  detail: `${formatMoney(month.sales)}${index === all.length - 1 ? " · en curso" : ""}`,
                  highlight: index === all.length - 1,
                }))}
              />
            ) : (
              <EmptyState icon={<FileText size={20} />} title="Aún no hay ventas" description="Cuando se confirmen reservas, verás aquí cómo van las ventas de cada mes." />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
