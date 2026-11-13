import type { Metadata } from "next";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { InfoTip } from "@/components/ui/InfoTip";
import { PeriodSwitch, TrendAndLive, VisitBreakdown, VisitTiles } from "@/features/tracking/WebVisits";
import { getResource } from "@/lib/server/resource";
import type { WebDevices, WebOverview, WebPage, WebSource } from "@/lib/tracking";

export const metadata: Metadata = { title: "Visitas del sitio" };

const PERIODS = [7, 30, 90];

export default async function VisitasPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const requested = Number((await searchParams).days);
  const days = PERIODS.includes(requested) ? requested : 30;
  const query = `?days=${days}`;
  const [overview, pages, sources, devices] = await Promise.all([
    getResource<WebOverview>(`/analytics/web/overview${query}`, "No pudimos cargar las visitas."),
    getResource<WebPage[]>(`/analytics/web/pages${query}`, "No pudimos cargar las páginas."),
    getResource<WebSource[]>(`/analytics/web/sources${query}`, "No pudimos cargar las fuentes."),
    getResource<WebDevices>(`/analytics/web/devices${query}`, "No pudimos cargar los dispositivos."),
  ]);

  if (!overview || !pages || !sources || !devices) {
    return <p className="rounded-tile border border-dashed border-line px-4 py-8 text-center text-[13.5px] text-fg-3">Tu rol no tiene acceso a las visitas del sitio.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-[17px] font-semibold">
            Visitas del sitio
            <InfoTip>Las visitas se cuentan sin cookies y sin datos personales, así que incluyen a quienes rechazan las cookies. {overview.ga4 ? overview.ga4.note : "Si conectas Google Analytics verás por qué muestra menos visitas."}</InfoTip>
          </h2>
          <p className="text-[12.5px] text-fg-3">
            Del {overview.period.from} al {overview.period.to}
            {overview.period.clamped ? ` · tu plan guarda ${overview.period.retention_days} días` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodSwitch base="/reportes/visitas" days={days} />
          {overview.can_export && <DownloadButton href={`/reportes/visitas/csv?days=${days}`} label="Exportar CSV" size="sm" />}
        </div>
      </div>
      <VisitTiles overview={overview} />
      <TrendAndLive overview={overview} />
      <VisitBreakdown pages={pages} sources={sources} devices={devices} />
    </div>
  );
}
