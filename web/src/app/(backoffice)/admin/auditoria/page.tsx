import { Activity, Boxes, CalendarDays, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { KpiGrid } from "@/features/admin/AdminParts";
import { AuditActivity, AuditBreakdown, AuditTable, TopEntities } from "@/features/admin/Audit";
import { AuditExportAction } from "@/features/admin/AuditExport";
import type { AuditEntry, AuditMeta, AuditOverview } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDate, formatNumber } from "@/lib/format";
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
  const peak = data.daily.slice(-14).reduce<AuditOverview["daily"][number] | null>((best, day) => (day.total > (best?.total ?? 0) ? day : best), null);
  const top = data.top_entities[0];
  const average = Math.round(data.days === 0 ? data.daily.reduce((sum, day) => sum + day.total, 0) / Math.max(1, data.daily.length) : data.kpis.total / data.days);
  const current = PERIODS.find((period) => period.days === data.days) ?? PERIODS[2];

  return (
    <>
      <PageHeader
        title="Auditoría"
        subtitle="Quién hizo qué, cuándo y qué cambió. Nadie puede editar ni borrar estos registros."
        info={<InfoTip>La bitácora es de solo agregar: ningún rol la modifica. Los eventos críticos incluyen inicios de sesión, cambios de permisos, aprobaciones, descuentos, anulaciones y exportaciones.</InfoTip>}
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
      <KpiGrid>
        <TintTile
          icon={Users}
          tone="t4"
          label="Personas y sistemas"
          value={data.kpis.actors}
          note={current.days === 0 ? "Desde el inicio" : `Con actividad en ${current.label.toLowerCase()}`}
          info={<p>Usuarios, integraciones y procesos automáticos distintos que dejaron al menos un evento en la bitácora del periodo elegido.</p>}
        />
        <TintTile
          icon={CalendarDays}
          tone="t1"
          label="Día de más actividad"
          value={peak ? formatDate(peak.date) : "Sin eventos"}
          note={peak ? `${formatNumber(peak.total)} eventos · últimas 2 semanas` : undefined}
          info={
            <>
              <p className="mb-2">Eventos registrados por día en las últimas dos semanas.</p>
              <div className="w-[270px]">
                <AuditActivity daily={data.daily} />
              </div>
            </>
          }
        />
        <TintTile
          icon={Boxes}
          tone="violet"
          label="Lo más registrado"
          value={top?.label ?? "Sin eventos"}
          note={top && data.kpis.total > 0 ? `${Math.round((top.total / data.kpis.total) * 100)} % de los eventos` : undefined}
          info={
            <>
              <p className="mb-2">Tipos de registro con más eventos en el periodo.</p>
              <div className="w-[270px]">
                <TopEntities items={data.top_entities} total={data.kpis.total} />
              </div>
            </>
          }
        />
        <TintTile
          icon={Activity}
          tone="sun"
          label="Promedio por día"
          value={formatNumber(average)}
          note={data.days === 0 ? "Eventos diarios, últimos 30 días" : "Eventos diarios del periodo"}
          info={<p>Eventos del periodo divididos entre sus días. Con «Todo», el promedio es el de los últimos 30 días.</p>}
        />
      </KpiGrid>
      <AuditBreakdown data={data} days={data.days} />
      {data.truncated && <p className="mb-3 text-[12.5px] text-fg-3">Se muestran los {formatNumber(data.events.length)} eventos más recientes del periodo. Acota el periodo para ver el resto.</p>}
      <AuditTable data={data} initialSearch={q} />
    </>
  );
}
