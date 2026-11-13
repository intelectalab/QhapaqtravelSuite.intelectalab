import { Activity, Boxes, CalendarDays, ShieldAlert } from "lucide-react";
import { TintTile } from "@/components/ui/Tinted";
import { KpiGrid } from "@/features/admin/AdminParts";
import { AuditActivity, TopEntities } from "@/features/admin/Audit";
import { formatDate, formatNumber } from "@/lib/format";
import type { AuditEvent } from "@/lib/platformBilling";

const DAY = 86_400_000;

const limaDay = (value: string | Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(value));

export function AuditKpis({ events }: { events: AuditEvent[] }) {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(limaDay(event.at), (counts.get(limaDay(event.at)) ?? 0) + 1);
  const today = new Date().getTime();
  const daily = Array.from({ length: 14 }, (_, index) => {
    const date = limaDay(new Date(today - (13 - index) * DAY));
    return { date, total: counts.get(date) ?? 0 };
  });
  const peak = daily.reduce<(typeof daily)[number] | null>((best, day) => (day.total > (best?.total ?? 0) ? day : best), null);
  const entities = new Map<string, number>();
  for (const event of events) entities.set(event.entity, (entities.get(event.entity) ?? 0) + 1);
  const top = [...entities.entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total).slice(0, 5);
  const critical = events.filter((event) => event.critical).length;
  const actors = new Set(events.map((event) => event.actor ?? "Sistema")).size;

  return (
    <KpiGrid>
      <TintTile icon={Activity} tone="t1" label="Eventos registrados" value={formatNumber(events.length)} note={`${formatNumber(actors)} ${actors === 1 ? "persona o proceso" : "personas y procesos"}`} info={<p>Eventos que se ven en la tabla: los 500 más recientes del equipo de plataforma y de los procesos automáticos.</p>} />
      <TintTile icon={ShieldAlert} tone="bad" label="Críticos" value={formatNumber(critical)} note={events.length > 0 ? `${Math.round((critical / events.length) * 100)} % del total` : undefined} info={<p>Suspensiones, cambios de plan, anulaciones, accesos denegados y demás acciones marcadas como críticas al registrarse.</p>} />
      <TintTile
        icon={CalendarDays}
        tone="violet"
        label="Día de más actividad"
        value={peak ? formatDate(peak.date) : "Sin eventos"}
        note={peak ? `${formatNumber(peak.total)} eventos · últimas 2 semanas` : undefined}
        info={
          <>
            <p className="mb-2">Eventos registrados por día en las últimas dos semanas, en hora de Lima.</p>
            <div className="w-[270px]">
              <AuditActivity daily={daily} />
            </div>
          </>
        }
      />
      <TintTile
        icon={Boxes}
        tone="sun"
        label="Lo más registrado"
        value={top[0]?.label ?? "Sin eventos"}
        note={top[0] && events.length > 0 ? `${Math.round((top[0].total / events.length) * 100)} % de los eventos` : undefined}
        info={
          <>
            <p className="mb-2">Tipos de registro con más eventos.</p>
            <div className="w-[270px]">
              <TopEntities items={top} total={events.length} />
            </div>
          </>
        }
      />
    </KpiGrid>
  );
}
