import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import { BarChart3, ChartPie, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { BarChart, Sparkline } from "@/components/ui/Charts";
import { ChartsPanel } from "@/components/ui/ChartsPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintCardTitle, ToneScope } from "@/components/ui/Tinted";
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

const BASE = "/crm/postventa";
const TABS = ["casos", "encuestas", "viajes", "recompra"] as const;

export default async function PostventaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [overview, loyalty, related, params] = await Promise.all([
    getResource<AfterSalesOverview>("/crm/after-sales", "No pudimos cargar postventa."),
    getCollection<LoyaltyRow, LoyaltyMeta>("/crm/loyalty/segments", "No pudimos cargar la segmentación."),
    getRelatedOptions(),
    searchParams,
  ]);

  if (!overview) {
    return <PageHeader title="Postventa y fidelización" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = overview;
  const trend = overview.trend.filter((month) => month.nps !== null);
  const tab = TABS.find((item) => item === params.tab && (item !== "recompra" || loyalty)) ?? "casos";
  const tabs = [
    { href: BASE, label: "Casos", count: kpis.open_cases },
    { href: `${BASE}?tab=encuestas`, label: "Encuestas", count: overview.surveys.length },
    { href: `${BASE}?tab=viajes`, label: "Viajes recientes", count: overview.trips.length },
    ...(loyalty ? [{ href: `${BASE}?tab=recompra`, label: "Segmentación y recompra", count: loyalty.data.length }] : []),
  ];
  const current = tab === "casos" ? BASE : `${BASE}?tab=${tab}`;

  return (
    <>
      <PageHeader
        title="Postventa y fidelización"
        subtitle="Cierra cada viaje con una encuesta y atiende a tiempo lo que el cliente no disfrutó."
        info={
          <>
            <InfoTip>NPS = % de promotores (9 y 10) menos % de detractores (0 a 6). Una encuesta de 6 o menos abre un caso para el responsable del cliente.</InfoTip>
            <ChartsPanel title="Gráficos de satisfacción" description="Encuestas respondidas por los clientes de tu cartera en los últimos 12 meses.">
              <section className="grid gap-4 lg:grid-cols-2">
                <Card className="lift lg:col-span-2">
                  <TintCardTitle icon={ChartPie} title="Promotores, pasivos y detractores" aside={<InfoTip label="De dónde sale">Las encuestas respondidas en los últimos 12 meses por los clientes de tu cartera, según su puntaje.</InfoTip>} />
                  <NpsDonut promoters={kpis.promoters} passives={kpis.passives} detractors={kpis.detractors} />
                </Card>
                <Card className="lift">
                  <TintCardTitle icon={BarChart3} title="Distribución de puntajes" aside="Últimos 12 meses" />
                  {kpis.responses > 0 ? (
                    <BarChart data={overview.distribution.map((item) => ({ label: String(item.score), value: item.count, caption: String(item.count), detail: `${item.count} ${item.count === 1 ? "respuesta" : "respuestas"} con ${item.score}`, highlight: item.score >= 9 }))} height={130} />
                  ) : (
                    <EmptyState icon={<BarChart3 size={20} />} title="Aún no hay encuestas" />
                  )}
                </Card>
                <ToneScope tone="ok">
                  <Card className="lift h-full">
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
            </ChartsPanel>
          </>
        }
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

      <TabbedCard tabs={tabs} active={current}>
        {tab === "encuestas" ? (
          <SurveysTable overview={overview} />
        ) : tab === "viajes" ? (
          <>
            <p className="mb-3 text-[13px] text-fg-3">Completados en 90 días o por terminar · {kpis.to_close} sin encuesta</p>
            <TripsList overview={overview} options={related} />
          </>
        ) : tab === "recompra" && loyalty ? (
          <>
            <p className="mb-3 flex items-center gap-1.5 text-[13px] text-fg-3">
              Clientes de tu cartera con su última compra, lo comprado y su último NPS.
              <InfoTip>Clientes de tu cartera con su última compra, lo comprado en soles (reservas vigentes), los destinos que ya visitaron (productos reservados y oportunidades ganadas) y su último NPS. La recompra crea una oportunidad en Calificación con origen Fidelización.</InfoTip>
            </p>
            <LoyaltyTable rows={loyalty.data} meta={loyalty.meta} owners={overview.owners} />
          </>
        ) : (
          <CasesTable overview={overview} />
        )}
      </TabbedCard>
    </>
  );
}
