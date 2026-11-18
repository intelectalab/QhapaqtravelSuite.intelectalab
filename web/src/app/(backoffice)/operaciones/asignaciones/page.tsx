import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
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

  return (
    <>
      <PageHeader
        title="Asignaciones y recursos"
        subtitle="Guías, conductores y vehículos, y quién cubre cada servicio."
        info={<InfoTip>Un recurso no puede tener dos servicios de órdenes distintas con menos de 6 horas de diferencia. Las licencias y SOAT se revisan contra la fecha del servicio.</InfoTip>}
      />
      <ResourcesBoard data={data} availability={availability} />
    </>
  );
}
