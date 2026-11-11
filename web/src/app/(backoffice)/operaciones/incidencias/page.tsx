import { CalendarPlus, Hourglass, Siren, Store, TimerReset } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { IncidentCreateAction, IncidentsTable } from "@/features/operations/Incidents";
import { Notice } from "@/features/operations/OpsBits";
import type { IncidentList } from "@/lib/operations";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Incidencias" };

export default async function IncidenciasPage() {
  const data = await getResource<IncidentList>("/ops/incidents", "No pudimos cargar las incidencias.");

  if (!data) {
    return <PageHeader title="Incidencias" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const open = ["abierta", "en_proceso"];
  const critical = data.items.filter((item) => item.severity === "critica" && open.includes(item.status));
  const month = data.now.slice(0, 7);
  const finished = data.items.filter((item) => !open.includes(item.status));
  const onTime = finished.filter((item) => item.on_time).length;
  const fromSuppliers = data.items.filter((item) => item.source === "extranet" && open.includes(item.status)).length;

  return (
    <>
      <PageHeader
        title="Incidencias"
        subtitle="Lo que pasa en destino, quién lo atiende y en qué plazo."
        info={<InfoTip>El plazo corre desde el registro: crítica 4 h, alta 8 h, media 24 h y baja 72 h. Al reclasificar se recalcula.</InfoTip>}
        actions={data.can.manage && data.orders.length > 0 ? <IncidentCreateAction data={data} /> : undefined}
      />

      {critical.map((item) => (
        <Notice key={item.code} tone="bad" icon={<Siren size={16} />} action={<Link href={`/operaciones/incidencias/${item.code}`} className="text-[13px] font-semibold text-[var(--tint)] hover:underline">Atender</Link>}>
          <b className="font-semibold">{item.title}</b> · {item.order?.title ?? item.reservation?.title}
        </Notice>
      ))}

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Hourglass} tone="accent" label="En proceso" value={data.kpis.in_process} note="Con responsable trabajando" info="Incidencias que alguien de Operaciones tomó y todavía no resuelve." />
        <TintTile icon={TimerReset} tone={finished.length && onTime / finished.length < 0.8 ? "warn" : "ok"} label="Resueltas a tiempo" value={finished.length ? `${Math.round((onTime / finished.length) * 100)} %` : "—"} note={`${onTime} de ${finished.length} resueltas o cerradas`} info="Resueltas o cerradas antes de que venciera su plazo (crítica 4 h, alta 8 h, media 24 h, baja 72 h)." />
        <TintTile icon={Store} tone="t3" label="Reportadas por proveedores" value={fromSuppliers} note="Abiertas, desde la extranet" info="Incidencias abiertas o en proceso que un hotel u operador reportó desde la extranet de proveedores." />
        <TintTile icon={CalendarPlus} tone="t1" label="Registradas este mes" value={data.items.filter((item) => item.created_at.slice(0, 7) === month).length} note="Todas las severidades" info="Incidencias creadas durante el mes en curso, desde la web, la app del operador o la extranet." />
      </section>

      <IncidentsTable data={data} />
    </>
  );
}
