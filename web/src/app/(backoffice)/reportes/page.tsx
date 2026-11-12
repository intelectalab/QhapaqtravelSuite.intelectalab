import { BarChart3, Briefcase, FileText, Radio, UsersRound, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { BarChart, PairedBarChart } from "@/components/ui/Charts";
import { KpiTile } from "@/components/ui/KpiTile";
import { TintCardTitle } from "@/components/ui/Tinted";
import { Ratio, ShareBars, StatusStrip } from "@/features/reports/ReportBlocks";
import { formatMoney, formatPercent } from "@/lib/format";
import type { KpiOverview } from "@/lib/reports";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Reportes y KPIs" };

export default async function ReportesPage() {
  const report = await getResource<KpiOverview>("/reports/kpis", "No pudimos cargar los reportes.");

  if (!report) {
    return null;
  }

  const { kpis, months, collection } = report;
  const change = kpis.sales_previous > 0 ? ((kpis.sales - kpis.sales_previous) / kpis.sales_previous) * 100 : null;
  const best = Math.max(...months.map((month) => month.sales));

  return (
    <>
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile tone="t1" label="Ventas del mes" value={formatMoney(kpis.sales, "PEN", { compact: true })} note={change === null ? "Sin mes anterior para comparar" : `${change >= 0 ? "+" : ""}${formatPercent(change, 0)} frente al mes anterior`} trend={months.map((month) => month.sales)} trendLabels={months.map((month) => `${month.label} · ${formatMoney(month.sales)}`)} />
        <KpiTile tone="t3" label="Margen bruto" value={kpis.margin_pct !== null ? formatPercent(kpis.margin_pct) : "—"} note={`${formatMoney(kpis.sales_period, "PEN", { compact: true })} vendidos en el período`} />
        <KpiTile tone="t4" label="Reservas" value={kpis.reservations} note={kpis.ticket !== null ? `Ticket promedio ${formatMoney(kpis.ticket)}` : "Sin reservas en el período"} trend={months.map((month) => month.reservations)} trendLabels={months.map((month) => `${month.label} · ${month.reservations} reservas`)} />
        <KpiTile tone="t2" label="Por cobrar" value={formatMoney(kpis.receivable_open, "PEN", { compact: true })} note={`${formatMoney(kpis.receivable_overdue)} vencido`} />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={BarChart3} title="Ventas por mes" aside={`Mejor mes: ${formatMoney(best, "PEN", { compact: true })}`} />
          <BarChart data={months.map((month) => ({ label: month.label, value: month.sales, caption: formatMoney(month.sales, "PEN", { compact: true }), detail: `${formatMoney(month.sales)} · ${month.reservations} reservas${month.margin_pct !== null ? ` · margen ${formatPercent(month.margin_pct, 0)}` : ""}`, highlight: month.key === months[months.length - 1]?.key }))} height={150} />
        </Card>
        <div className="grid gap-3">
          <Ratio label="Conversión de leads" value={report.leads.rate} note={`${report.leads.converted} de ${report.leads.total} leads pasaron a oportunidad`} tone="violet" />
          <Ratio label="Cotizaciones ganadas" value={report.quotes.win_rate} note={`${report.quotes.won} aprobadas o convertidas · ${report.quotes.open} abiertas`} tone="ok" />
          <Ratio label="Cobranza" value={collection.rate} note={`${formatMoney(collection.collected)} cobrados de ${formatMoney(collection.billed)}`} tone="t1" />
        </div>
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <TintCardTitle icon={UsersRound} title="Leads y cotizaciones por mes" />
          <PairedBarChart data={months.map((month) => ({ label: month.label, first: month.leads, second: month.quotes }))} labels={["Leads", "Cotizaciones"]} />
        </Card>
        <Card>
          <TintCardTitle icon={FileText} title="Embudo de cotizaciones" aside={report.quotes.avg_margin !== null ? `Margen promedio ${formatPercent(report.quotes.avg_margin)}` : undefined} />
          <StatusStrip items={report.quotes.by_status} />
          <p className="mt-4 text-[13px]">
            Propuestas abiertas por <b>{formatMoney(report.quotes.pipeline_pen)}</b> en soles.
          </p>
          <div className="mt-4 border-t border-line-2 pt-4">
            <p className="mb-2 text-[12.5px] font-semibold text-fg-3">Leads por estado</p>
            <StatusStrip items={report.leads.by_status} />
          </div>
        </Card>
      </section>

      <section className={report.scope === "tenant" ? "grid gap-4 lg:grid-cols-3" : "grid gap-4 lg:grid-cols-2"}>
        <Card>
          <TintCardTitle icon={Wallet} title="Antigüedad de la deuda" tone="bad" aside={`${collection.overdue_count} vencidas`} />
          <BarChart data={collection.aging.map((bucket, index) => ({ label: bucket.label.replace(" días", "d"), value: bucket.amount, caption: formatMoney(bucket.amount, "PEN", { compact: true }), detail: `${bucket.count} cuentas · ${formatMoney(bucket.amount)}`, highlight: index > 0 && bucket.amount > 0 }))} height={110} />
        </Card>
        <ShareBars title="Ventas por canal" icon={Radio} rows={report.channels} tone="t3" empty="Sin ventas en el período." />
        {report.scope === "tenant" && <ShareBars title="Ventas por asesor" icon={Briefcase} rows={report.advisors} tone="violet" empty="Sin ventas en el período." />}
      </section>
    </>
  );
}
