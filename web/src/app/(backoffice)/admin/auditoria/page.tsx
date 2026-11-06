import { Activity, Ban, Boxes, CalendarDays, ShieldAlert, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { KpiGrid } from "@/features/admin/AdminParts";
import { AuditActivity, AuditTable, TopEntities } from "@/features/admin/Audit";
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

export default async function AuditoriaPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { periodo } = await searchParams;
  const days = PERIODS.find((period) => String(period.days) === periodo)?.days ?? 30;
  const page = await getCollection<AuditEntry, AuditMeta>(`/audit-events?filter[days]=${days}`, "No pudimos cargar la auditoría.", 1500);
  if (!page) return <NoAccess home="/dashboard" />;
  const data: AuditOverview = { days: page.meta.days, total: page.meta.total, truncated: page.more, events: page.data, kpis: page.meta.kpis, top_entities: page.meta.top_entities, daily: page.meta.daily };
  const current = PERIODS.find((period) => period.days === data.days) ?? PERIODS[2];

  return (
    <>
      <PageHeader
        title="Auditoría"
        subtitle="Quién hizo qué, cuándo y qué cambió. Nadie puede editar ni borrar estos registros."
        info={<InfoTip>La bitácora es de solo agregar: ningún rol la modifica. Los eventos críticos incluyen inicios de sesión, cambios de permisos, aprobaciones, descuentos, anulaciones y exportaciones.</InfoTip>}
        actions={
          <nav aria-label="Periodo" className="flex gap-1 rounded-control bg-surface-2 p-1">
            {PERIODS.map((period) => (
              <Link key={period.days} href={`/admin/auditoria?periodo=${period.days}`} aria-current={period.days === data.days ? "page" : undefined} className={cn("rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold transition-[background-color,color] duration-200", period.days === data.days ? "bg-surface text-fg shadow-card" : "text-fg-3 hover:text-fg")}>
                {period.label}
              </Link>
            ))}
          </nav>
        }
      />
      <KpiGrid>
        <TintTile icon={Activity} tone="t1" label="Eventos" value={formatNumber(data.kpis.total)} note={current.days === 0 ? "Desde el inicio" : `En ${current.label.toLowerCase()}`} />
        <TintTile icon={ShieldAlert} tone="bad" label="Críticos" value={formatNumber(data.kpis.critical)} note={data.kpis.total > 0 ? `${Math.round((data.kpis.critical / data.kpis.total) * 100)} % del total` : undefined} />
        <TintTile icon={Users} tone="t4" label="Personas y sistemas" value={data.kpis.actors} note={`${data.kpis.today} eventos hoy`} />
        <TintTile icon={Ban} tone="warn" label="Accesos denegados" value={formatNumber(data.kpis.denied)} note="Intentos fuera del rol" />
      </KpiGrid>
      <div className="mb-5 grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={CalendarDays} title="Actividad de las últimas dos semanas" />
          <AuditActivity daily={data.daily} />
        </Card>
        <Card>
          <TintCardTitle icon={Boxes} title="Lo más registrado" aside={current.label} />
          <TopEntities items={data.top_entities} total={data.kpis.total} />
        </Card>
      </div>
      {data.truncated && <p className="mb-3 text-[12.5px] text-fg-3">Se muestran los {formatNumber(data.events.length)} eventos más recientes del periodo. Acota el periodo para ver el resto.</p>}
      <AuditTable data={data} />
    </>
  );
}
