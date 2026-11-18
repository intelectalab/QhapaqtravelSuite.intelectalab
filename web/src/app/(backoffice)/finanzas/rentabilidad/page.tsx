import { ChartColumnBig, Package, Radio, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/Charts";
import { ChartsPanel } from "@/components/ui/ChartsPanel";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
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

  const { target, floor } = data;

  return (
    <>
      <PageHeader
        title="Rentabilidad"
        subtitle="Margen de cada reserva vendida, por canal, producto y asesor."
        info={
          <>
            <InfoTip>Ingreso: total de la reserva en soles. Costo: servicios no cancelados más costos adicionales aprobados. Utilidad neta: margen bruto menos comisiones. Meta {target} %; por debajo de {floor} % la reserva queda bajo mínimo.</InfoTip>
            <ChartsPanel title="Gráficos de rentabilidad" description="Margen de las reservas por mes de viaje, canal, tipo de servicio y asesor.">
              <section className="grid gap-4 lg:grid-cols-2">
                <Card className="lift">
                  <TintCardTitle icon={ChartColumnBig} title="Margen por mes de viaje" aside={<InfoTip label="De dónde sale">Margen bruto en soles de las reservas, agrupado por el mes en que empieza el viaje. Pasa el cursor por cada barra para ver ingreso, costo y margen.</InfoTip>} />
                  <BarChart data={data.monthly.map((month, index) => ({ label: month.label, value: Math.max(0, month.margin_pen), caption: formatMoney(month.margin_pen, "PEN", { compact: true }), detail: `Margen ${formatPercent(month.margin_pct)} · ingreso ${formatMoney(month.income_pen)} · costo ${formatMoney(month.cost_pen)}`, highlight: index === data.monthly.length - 1 }))} />
                </Card>
                <Card className="lift">
                  <TintCardTitle icon={Radio} title="Por canal" aside={<InfoTip label="De dónde sale">Margen bruto de las reservas según el canal de venta. El color compara su margen con la meta y el mínimo.</InfoTip>} />
                  <RankBars empty="Sin reservas vendidas." data={ranked(data.by_channel, target, floor)} />
                </Card>
                <Card className="lift">
                  <TintCardTitle icon={Package} title="Por tipo de servicio" aside={<InfoTip label="De dónde sale">Margen bruto de los servicios vendidos, agrupado por tipo. El color compara su margen con la meta y el mínimo.</InfoTip>} />
                  <RankBars empty="Sin servicios vendidos." data={ranked(data.by_product, target, floor)} />
                </Card>
                <Card className="lift">
                  <TintCardTitle icon={UserRound} title="Por asesor" aside={<InfoTip label="De dónde sale">Margen bruto de las reservas de cada asesor. El color compara su margen con la meta y el mínimo.</InfoTip>} />
                  <RankBars empty="Sin reservas vendidas." data={ranked(data.by_owner, target, floor)} />
                </Card>
              </section>
            </ChartsPanel>
          </>
        }
      />
      <ProfitabilityTable data={data} />
    </>
  );
}
