import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { ChartsPanel } from "@/components/ui/ChartsPanel";
import { InfoTip } from "@/components/ui/InfoTip";
import { AuditBreakdown, AuditTable } from "@/features/admin/Audit";
import { AuditExportAction } from "@/features/admin/AuditExport";
import type { AuditEntry, AuditMeta, AuditOverview } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { getCollection } from "@/lib/server/admin";

export const metadata: Metadata = { title: "Auditoría" };

const PERIODS = [
  { days: 1, label: "Hoy" },
  { days: 7, label: "7 días" },
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 0, label: "Todo" },
];

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ periodo?: string; q?: string }> }) {
  const { periodo, q } = await searchParams;
  const days = PERIODS.find((period) => String(period.days) === periodo)?.days ?? 30;
  const page = await getCollection<AuditEntry, AuditMeta>(`/audit-events?filter[days]=${days}`, "No pudimos cargar la auditoría.", 1500);
  if (!page) return <NoAccess home="/dashboard" />;
  const data: AuditOverview = { days: page.meta.days, total: page.meta.total, truncated: page.more, events: page.data, kpis: page.meta.kpis, top_entities: page.meta.top_entities, daily: page.meta.daily, by_actor: page.meta.by_actor, critical_by_action: page.meta.critical_by_action };
  const current = PERIODS.find((period) => period.days === data.days) ?? PERIODS[2];

  return (
    <>
      <PageHeader
        title="Auditoría"
        subtitle="Quién hizo qué, cuándo y qué cambió. Nadie puede editar ni borrar estos registros."
        info={
          <>
            <InfoTip>La bitácora es de solo agregar: ningún rol la modifica. Los eventos críticos incluyen inicios de sesión, cambios de permisos, aprobaciones, descuentos, anulaciones y exportaciones.</InfoTip>
            <ChartsPanel title="Gráficos de auditoría" description={`Eventos del periodo elegido (${current.label.toLowerCase()}): ${formatNumber(data.kpis.actors)} personas y sistemas con actividad.`}>
              <AuditBreakdown data={data} days={data.days} />
            </ChartsPanel>
          </>
        }
        actions={
          <span className="flex flex-wrap items-center gap-2">
          <nav aria-label="Periodo" className="flex gap-1 rounded-control bg-surface-2 p-1">
            {PERIODS.map((period) => (
              <Link key={period.days} href={`/admin/auditoria?periodo=${period.days}`} aria-current={period.days === data.days ? "page" : undefined} className={cn("rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold transition-[background-color,color] duration-200", period.days === data.days ? "bg-surface text-fg shadow-card" : "text-fg-3 hover:text-fg")}>
                {period.label}
              </Link>
            ))}
          </nav>
          <AuditExportAction days={data.days} label={current.days === 0 ? "Todo el historial" : current.label} />
          </span>
        }
      />
      {data.truncated && <p className="mb-3 text-[12.5px] text-fg-3">Se muestran los {formatNumber(data.events.length)} eventos más recientes del periodo. Acota el periodo para ver el resto.</p>}
      <AuditTable data={data} initialSearch={q} />
    </>
  );
}
