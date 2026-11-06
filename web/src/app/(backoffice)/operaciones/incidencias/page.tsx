import { Clock3, Hourglass, Siren, TimerOff } from "lucide-react";
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

  const critical = data.items.filter((item) => item.severity === "critica" && ["abierta", "en_proceso"].includes(item.status));

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
        <TintTile icon={Clock3} tone="info" label="Abiertas" value={data.kpis.open} />
        <TintTile icon={Siren} tone="bad" label="Críticas abiertas" value={data.kpis.critical} />
        <TintTile icon={Hourglass} tone="accent" label="En proceso" value={data.kpis.in_process} />
        <TintTile icon={TimerOff} tone="warn" label="Plazo vencido" value={data.kpis.overdue} />
      </section>

      <IncidentsTable data={data} />
    </>
  );
}
