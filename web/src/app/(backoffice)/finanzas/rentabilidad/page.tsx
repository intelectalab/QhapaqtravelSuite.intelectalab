import { ChartColumnBig, Coins, Package, Percent, PiggyBank, TrendingUp, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/Charts";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { ProfitabilityTable } from "@/features/finance/Profitability";
import { RankBars } from "@/features/finance/RankBars";
import type { ProfitabilityOverview, ProfitGroup } from "@/lib/finance";
import { formatMoney, formatPercent } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Rentabilidad" };

const ranked = (groups: ProfitGroup[], target: number, floor: number) =>
  groups.map((group) => ({
    label: group.name,
    value: group.margin_pen,
    caption: `${formatMoney(group.margin_pen, "PEN", { compact: true })} · ${formatPercent(group.margin_pct)}`,
    detail: `Ingreso ${formatMoney(group.income_pen)} · ${group.count === 1 ? "1 registro" : `${group.count} registros`}`,
    tone: group.margin_pct >= target ? ("ok" as const) : group.margin_pct >= floor ? ("warn" as const) : ("bad" as const),
  }));

export default async function RentabilidadPage() {
  const data = await getResource<ProfitabilityOverview>("/finance/profitability", "No pudimos cargar la rentabilidad.");

  if (!data) {
    return <PageHeader title="Rentabilidad" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis, target, floor } = data;

  return (
    <>
      <PageHeader
        title="Rentabilidad"
        subtitle="Margen de cada reserva vendida, por producto y por asesor."
        info={<InfoTip>Ingreso: total de la reserva en soles. Costo: servicios no cancelados más costos adicionales aprobados. Utilidad neta: margen bruto menos comisiones. Meta {target} %; por debajo de {floor} % la reserva queda bajo mínimo.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={TrendingUp} tone="t1" label="Ingresos" value={formatMoney(kpis.income_pen, "PEN", { compact: true })} note={`Costos ${formatMoney(kpis.cost_pen, "PEN", { compact: true })}`} />
        <TintTile icon={Coins} tone="ok" label="Margen bruto" value={formatMoney(kpis.margin_pen, "PEN", { compact: true })} />
        <TintTile icon={Percent} tone={kpis.margin_pct >= target ? "ok" : kpis.margin_pct >= floor ? "sun" : "bad"} label="Margen promedio" value={formatPercent(kpis.margin_pct)} note={kpis.below_floor === 0 ? "Ninguna bajo mínimo" : kpis.below_floor === 1 ? "1 reserva bajo mínimo" : `${kpis.below_floor} reservas bajo mínimo`} />
        <TintTile icon={PiggyBank} tone="violet" label="Utilidad neta" value={formatMoney(kpis.net_pen, "PEN", { compact: true })} note={`Comisiones ${formatMoney(kpis.commissions_pen, "PEN", { compact: true })}`} />
      </section>
      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card>
          <TintCardTitle icon={ChartColumnBig} title="Margen por mes de viaje" aside="En soles" />
          <BarChart data={data.monthly.map((month, index) => ({ label: month.label, value: Math.max(0, month.margin_pen), caption: formatMoney(month.margin_pen, "PEN", { compact: true }), detail: `Ingreso ${formatMoney(month.income_pen)} · costo ${formatMoney(month.cost_pen)}`, highlight: index === data.monthly.length - 1 }))} />
        </Card>
        <Card>
          <TintCardTitle icon={Package} title="Por tipo de servicio" />
          <RankBars empty="Sin servicios vendidos." data={ranked(data.by_product, target, floor)} />
        </Card>
        <Card>
          <TintCardTitle icon={UserRound} title="Por asesor" />
          <RankBars empty="Sin reservas vendidas." data={ranked(data.by_owner, target, floor)} />
        </Card>
      </div>
      <ProfitabilityTable data={data} />
    </>
  );
}
