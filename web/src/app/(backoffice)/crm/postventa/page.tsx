import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import { BarChart3, ChartPie, ClipboardList, Gauge, HeartHandshake, LifeBuoy, PlaneLanding, Repeat2, Smile, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { BarChart, Sparkline } from "@/components/ui/Charts";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { CaseFormAction, SurveyAction } from "@/features/aftersales/AfterSalesForms";
import { CasesTable, SurveysTable } from "@/features/aftersales/AfterSalesTables";
import { NpsDonut } from "@/features/aftersales/NpsDonut";
import { TripsList } from "@/features/aftersales/TripsList";
import { SharedAdvisorFilter } from "@/features/crm/AdvisorFilter";
import { LoyaltyTable } from "@/features/aftersales/LoyaltyTable";
import type { AfterSalesOverview, LoyaltyMeta, LoyaltyRow } from "@/lib/aftersales";
import { getCollection } from "@/lib/server/admin";
import { getRelatedOptions } from "@/lib/server/activities";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Postventa y fidelización" };

export default async function PostventaPage() {
  const [overview, loyalty, related] = await Promise.all([
    getResource<AfterSalesOverview>("/crm/after-sales", "No pudimos cargar postventa."),
    getCollection<LoyaltyRow, LoyaltyMeta>("/crm/loyalty/segments", "No pudimos cargar la segmentación."),
    getRelatedOptions(),
  ]);

  if (!overview) {
    return <PageHeader title="Postventa y fidelización" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = overview;
  const trend = overview.trend.filter((month) => month.nps !== null);

  return (
    <>
      <PageHeader
        title="Postventa y fidelización"
        subtitle="Cierra cada viaje con una encuesta y atiende a tiempo lo que el cliente no disfrutó."
        info={<InfoTip>NPS = % de promotores (9 y 10) menos % de detractores (0 a 6). Una encuesta de 6 o menos abre un caso para el responsable del cliente.</InfoTip>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SharedAdvisorFilter advisors={overview.owners} />
            {overview.can.manage && (
              <>
                <CaseFormAction overview={overview} />
                <SurveyAction overview={overview} />
              </>
            )}
          </div>
        }
      />
      <ConsultModeNotice permissions={["crm.clients.manage"]} what="registrar encuestas ni casos" />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={PlaneLanding} tone="t1" label="Viajes por cerrar" value={kpis.to_close} note="Sin encuesta" info={<p>Viajes completados en los últimos 90 días, o por terminar, que todavía no tienen encuesta de satisfacción.</p>} />
        <TintTile icon={Gauge} tone={kpis.nps !== null && kpis.nps >= 50 ? "ok" : kpis.nps !== null && kpis.nps < 0 ? "bad" : "sun"} label="NPS últimos 12 meses" value={kpis.nps ?? "Sin datos"} note="% promotores menos % detractores" info={<p>Encuestas respondidas en los últimos 12 meses de los clientes de tu cartera. Promotores puntúan 9 o 10; detractores, de 0 a 6.</p>} />
        <TintTile icon={Smile} tone="violet" label="Puntaje promedio" value={kpis.average ?? "Sin datos"} note={`${kpis.responses} respuestas`} info={<p>Promedio de 0 a 10 de las mismas encuestas de los últimos 12 meses.</p>} />
        <TintTile icon={LifeBuoy} tone="bad" label="Casos abiertos" value={kpis.open_cases} note="Reclamos y quejas en curso" info={<p>Casos de postventa abiertos o en atención, incluidos los que abre una encuesta de 6 o menos.</p>} />
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="lift lg:col-span-2 xl:col-span-1">
          <TintCardTitle icon={ChartPie} title="Promotores, pasivos y detractores" aside={<InfoTip label="De dónde sale">Las encuestas respondidas en los últimos 12 meses por los clientes de tu cartera, según su puntaje.</InfoTip>} />
          <NpsDonut promoters={kpis.promoters} passives={kpis.passives} detractors={kpis.detractors} />
        </Card>
        <Card>
          <TintCardTitle icon={BarChart3} title="Distribución de puntajes" aside="Últimos 12 meses" />
          {kpis.responses > 0 ? (
            <BarChart data={overview.distribution.map((item) => ({ label: String(item.score), value: item.count, caption: String(item.count), detail: `${item.count} ${item.count === 1 ? "respuesta" : "respuestas"} con ${item.score}`, highlight: item.score >= 9 }))} height={130} />
          ) : (
            <EmptyState icon={<BarChart3 size={20} />} title="Aún no hay encuestas" />
          )}
        </Card>
        <ToneScope tone="ok">
          <Card className="h-full">
            <TintCardTitle icon={TrendingUp} title="NPS por mes" aside={trend.length > 0 ? `Último: ${trend[trend.length - 1].nps}` : undefined} />
            {trend.length > 1 ? (
              <div className="relative h-[120px] text-ok">
                <Sparkline values={trend.map((month) => month.nps ?? 0)} labels={trend.map((month) => `${month.label} · NPS ${month.nps} · ${month.responses} resp.`)} className="h-full" />
              </div>
            ) : (
              <p className="text-[13px] text-fg-3">Se necesita al menos dos meses con encuestas para ver la tendencia.</p>
            )}
            <ul className="mt-3 grid grid-cols-6 gap-1 text-center text-[11.5px] text-fg-3">
              {overview.trend.map((month) => (
                <li key={month.key} title={`${month.responses} respuestas`}>
                  <b className="block text-[13px] text-fg">{month.nps ?? "—"}</b>
                  {month.label}
                </li>
              ))}
            </ul>
          </Card>
        </ToneScope>
      </section>

      <Card className="mb-5">
        <TintCardTitle icon={HeartHandshake} title="Viajes recientes" aside="Completados en 90 días o por terminar" />
        <TripsList overview={overview} options={related} />
      </Card>

      {loyalty && (
        <Card className="mb-5">
          <TintCardTitle
            icon={Repeat2}
            title="Segmentación y recompra"
            aside={<InfoTip>Clientes de tu cartera con su última compra, lo comprado en soles (reservas vigentes), los destinos que ya visitaron (productos reservados y oportunidades ganadas) y su último NPS. La recompra crea una oportunidad en Calificación con origen Fidelización.</InfoTip>}
          />
          <LoyaltyTable rows={loyalty.data} meta={loyalty.meta} owners={overview.owners} />
        </Card>
      )}

      <Card className="mb-5">
        <TintCardTitle icon={ClipboardList} title="Casos de postventa" />
        <CasesTable overview={overview} />
      </Card>
      <Card>
        <TintCardTitle icon={Smile} title="Encuestas" />
        <SurveysTable overview={overview} />
      </Card>
    </>
  );
}
