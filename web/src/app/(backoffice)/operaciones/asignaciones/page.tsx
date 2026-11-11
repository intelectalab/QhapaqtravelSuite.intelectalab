import { Bus, Compass, IdCard, UserRoundX } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { ResourcesBoard } from "@/features/operations/Resources";
import type { ResourceAvailability, ResourceOverview } from "@/lib/operations";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Asignaciones y recursos" };

export default async function AsignacionesPage({ searchParams }: PageProps<"/operaciones/asignaciones">) {
  const { desde } = await searchParams;
  const from = typeof desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : null;
  const [data, availability] = await Promise.all([
    getResource<ResourceOverview>("/ops/resources", "No pudimos cargar los recursos."),
    getResource<ResourceAvailability>(`/ops/resources/availability${from ? `?from=${from}` : ""}`, "No pudimos cargar la disponibilidad."),
  ]);

  if (!data) {
    return <PageHeader title="Asignaciones y recursos" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const available = (rows: { status: string }[]) => rows.filter((row) => row.status === "disponible").length;
  const pending = data.assignments.filter((row) => row.status === "pendiente" && row.date >= data.today).length;
  const documents = data.drivers.filter((row) => row.document !== "vigente").length + data.vehicles.filter((row) => row.document !== "vigente").length;

  return (
    <>
      <PageHeader
        title="Asignaciones y recursos"
        subtitle="Guías, conductores y vehículos, y quién cubre cada servicio."
        info={<InfoTip>Un recurso no puede tener dos servicios de órdenes distintas con menos de 6 horas de diferencia. Las licencias y SOAT se revisan contra la fecha del servicio.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Compass} tone="t1" label="Guías disponibles" value={`${available(data.guides)} de ${data.guides.length}`} info="Guías activos en estado disponible; no cuenta a los que están en descanso o de vacaciones." />
        <TintTile icon={Bus} tone="t4" label="Flota disponible" value={`${available(data.vehicles)} de ${data.vehicles.length}`} note={`${available(data.drivers)} conductores libres`} info="Vehículos disponibles (no en mantenimiento). La nota cuenta los conductores disponibles." />
        <TintTile icon={UserRoundX} tone="warn" label="Servicios sin recursos" value={pending} note="Desde hoy" info="Tours y traslados de hoy en adelante que aún no tienen guía, conductor ni vehículo." />
        <TintTile icon={IdCard} tone="bad" label="Documentos por vencer" value={documents} note="Licencias y SOAT a 30 días" info="Licencias de conducir y SOAT vencidos o que vencen en los próximos 30 días." />
      </section>
      <ResourcesBoard data={data} availability={availability} />
    </>
  );
}
