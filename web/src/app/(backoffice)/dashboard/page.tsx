import { ArrowRight, Clock, FileText, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionList, type ActionListItem } from "@/components/ui/ActionList";
import { StatusBadge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/Charts";
import { KpiTile } from "@/components/ui/KpiTile";
import { attentionItems, homeKpis, monthlySales, upcomingDepartures, type AttentionKind } from "@/data/home";
import { BUSINESS_DATE } from "@/data/workspace";
import { currentUser } from "@/lib/server/me";
import { capitalize, formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { Tone } from "@/lib/tone";

export const metadata: Metadata = { title: "Panel de control" };

const ATTENTION_LOOK: Record<AttentionKind, { tone: Tone; icon: React.ReactNode }> = {
  incident: { tone: "bad", icon: <TriangleAlert size={17} strokeWidth={2} /> },
  collection: { tone: "warn", icon: <Clock size={17} strokeWidth={2} /> },
  quote: { tone: "accent", icon: <FileText size={17} strokeWidth={2} /> },
};

function LinkArrow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent">
      {children}
      <ArrowRight size={14} strokeWidth={2.2} />
    </Link>
  );
}

export default async function InicioPage() {
  const kpis = homeKpis();
  const attention: ActionListItem[] = attentionItems().map((item, index) => ({ id: `${item.kind}-${index}`, ...ATTENTION_LOOK[item.kind], ...item }));
  const departures = upcomingDepartures();
  const me = await currentUser();
  const firstName = me.name.split(" ")[0];
  const pending = attention.length;

  return (
    <>
      <div className="mb-5 mt-6 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[32px] font-bold leading-[1.08] tracking-[-0.04em] sm:text-[38px]">
          Hola, {firstName}
          <span className="text-brand">.</span>
          <br />
          <span className="font-semibold text-fg-3">
            {pending === 0 ? "Todo está al día." : `Tienes ${pending} ${pending === 1 ? "cosa" : "cosas"} por resolver hoy.`}
          </span>
        </h1>
        <p className="text-right text-[13px] text-fg-3">
          <b className="mb-0.5 block font-mono text-[13px] font-semibold tracking-wide text-fg">{capitalize(formatDate(BUSINESS_DATE, "long"))}</b>
          {me.tenant.name}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile tone="t1" label="Ventas del mes" value={formatMoney(kpis.sales, "PEN", { compact: true })} note={`${kpis.salesDelta > 0 ? "+" : "−"}${formatPercent(Math.abs(kpis.salesDelta))} frente a ${kpis.previousMonth}`} trend={kpis.trend.sales} />
        <KpiTile tone="t2" label="Margen bruto" value={formatPercent(kpis.margin)} note={`Meta del mes: ${kpis.marginGoal} %`} trend={kpis.trend.sales.map((sale, index) => sale - kpis.trend.cost[index])} />
        <KpiTile tone="t3" label="Por cobrar" value={formatMoney(kpis.receivable, "PEN", { compact: true })} note={`${formatMoney(kpis.overdue)} vencidos`} />
        <KpiTile tone="t4" label="Reservas activas" value={kpis.activeReservations} note={`${kpis.passengers} pasajeros`} />
      </div>

      <div className="mt-3.5 grid grid-cols-1 gap-3.5 lg:grid-cols-12">
        <Card className="lg:col-span-7">
          <CardHeader title="Por resolver" action={<span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] font-semibold text-fg-2">{pending}</span>} />
          <ActionList items={attention} />
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader title="Próximas salidas" action={<LinkArrow href="/reservas">Ver reservas</LinkArrow>} />
          <ul>
            {departures.map((departure) => (
              <li key={departure.id} className="grid grid-cols-[64px_1fr_auto] items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                <span className="font-mono text-[13px] font-semibold uppercase">{formatDate(departure.date).replace(/ \d{4}$/, "")}</span>
                <span className="min-w-0">
                  <Link href={`/reservas/${departure.id}`} className="block truncate text-[13.5px] font-semibold hover:underline">
                    {departure.title}
                  </Link>
                  <span className="text-xs text-fg-3">
                    {departure.id} · {departure.passengers} {departure.passengers === 1 ? "pasajero" : "pasajeros"}
                  </span>
                </span>
                <StatusBadge status={departure.status} />
              </li>
            ))}
          </ul>
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
            <BarChart
              data={monthlySales().map((month, index, all) => ({
                label: month.label,
                value: month.sales,
                caption: String(Math.round(month.sales / 1000)),
                highlight: index === all.length - 1,
              }))}
            />
          </div>
        </Card>
      </div>
    </>
  );
}
