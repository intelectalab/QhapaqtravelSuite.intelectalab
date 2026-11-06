import { BarChart3, ClipboardList, Gauge, HeartHandshake, LifeBuoy, PlaneLanding, Smile, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { LiveTag, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { BarChart, Sparkline } from "@/components/ui/Charts";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { CaseFormAction, SurveyAction } from "@/features/aftersales/AfterSalesForms";
import { CasesTable, ScoreBadge, SurveysTable } from "@/features/aftersales/AfterSalesTables";
import type { AfterSalesOverview } from "@/lib/aftersales";
import { formatDate, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Postventa y fidelización" };

export default async function PostventaPage() {
  const overview = await getResource<AfterSalesOverview>("/crm/after-sales", "No pudimos cargar postventa.");

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
          overview.can.manage ? (
            <div className="flex gap-2">
              <CaseFormAction overview={overview} />
              <SurveyAction overview={overview} />
            </div>
          ) : undefined
        }
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={PlaneLanding} tone="t1" label="Viajes por cerrar" value={kpis.to_close} note="Sin encuesta" />
        <TintTile icon={Gauge} tone={kpis.nps !== null && kpis.nps >= 50 ? "ok" : kpis.nps !== null && kpis.nps < 0 ? "bad" : "sun"} label="NPS últimos 12 meses" value={kpis.nps ?? "Sin datos"} note={`${kpis.promoters} promotores · ${kpis.detractors} detractores`} />
        <TintTile icon={Smile} tone="violet" label="Puntaje promedio" value={kpis.average ?? "Sin datos"} note={`${kpis.responses} respuestas`} />
        <TintTile icon={LifeBuoy} tone="bad" label="Casos abiertos" value={kpis.open_cases} note="Reclamos y quejas en curso" />
      </section>

      <section className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={BarChart3} title="Distribución de puntajes" aside={`${kpis.responses} respuestas`} />
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
        {overview.trips.length === 0 ? (
          <EmptyState icon={<PlaneLanding size={20} />} title="No hay viajes por cerrar" description="Cuando un viaje termine aparecerá aquí para registrar la encuesta." />
        ) : (
          <ul className="grid gap-2.5 md:grid-cols-2">
            {overview.trips.map((trip, index) => (
              <li key={trip.code} style={{ animationDelay: `${index * 60}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-3 rounded-tile border border-line px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/reservas/${trip.code}`} className="block truncate text-[13.5px] font-semibold hover:text-accent">
                    {trip.title}
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
                    <span>{trip.client.name}</span>
                    <span>{formatDate(trip.travel_to)}</span>
                    <span>{formatMoney(trip.total, trip.currency)}</span>
                    {trip.status === "en_operacion" ? <LiveTag>De viaje</LiveTag> : <StatusBadge status={trip.status} />}
                  </p>
                </div>
                {trip.survey ? <ScoreBadge score={trip.survey.score} category={trip.survey.score >= 9 ? "promotor" : trip.survey.score >= 7 ? "pasivo" : "detractor"} /> : overview.can.manage ? <SurveyAction overview={overview} trip={trip} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mb-5">
        <TintCardTitle icon={ClipboardList} title="Casos de postventa" aside={`${overview.cases.length} registrados`} />
        <CasesTable overview={overview} />
      </Card>
      <Card>
        <TintCardTitle icon={Smile} title="Encuestas" aside={`${overview.surveys.length} en total`} />
        <SurveysTable overview={overview} />
      </Card>
    </>
  );
}
