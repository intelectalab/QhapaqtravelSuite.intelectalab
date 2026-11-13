import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import { Boxes, Building2, CalendarClock, Truck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { ServiceCreateAction } from "@/features/catalog-services/ServiceForms";
import { ServicesTable } from "@/features/catalog-services/ServicesTable";
import type { ServicesOverview } from "@/lib/catalog-services";
import { formatDate } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const overview = await getResource<ServicesOverview>("/catalog/services", "No pudimos cargar los servicios.");

  if (!overview) {
    return <PageHeader title="Servicios" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const services = overview.services;
  const next = services.filter((service) => service.state === "activo" && service.expires_in >= 0).sort((a, b) => a.valid_to.localeCompare(b.valid_to))[0];
  const typeCounts = services.reduce<Record<string, number>>((sum, service) => ({ ...sum, [service.type]: (sum[service.type] ?? 0) + 1 }), {});
  const commonType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0];
  const used = services.filter((service) => service.products.length > 0);
  const providers = new Map(services.map((service) => [service.provider.id, service.provider]));
  const activeProviders = [...providers.values()].filter((provider) => provider.state === "activo").length;

  return (
    <>
      <PageHeader
        title="Servicios"
        subtitle="Lo que compras a tus proveedores para armar cada producto."
        info={<InfoTip>Un servicio vencido o de un proveedor inactivo no se puede usar como componente, y bloquea la activación de los productos que lo incluyen.</InfoTip>}
        actions={overview.can.manage ? <ServiceCreateAction overview={overview} /> : undefined}
      />
      <ConsultModeNotice permissions={["catalog.providers.manage"]} what="registrar ni editar servicios" />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={Boxes} tone="t1" label="En productos" value={used.length} note={`${services.length - used.length} sin usar todavía`} info={<p>Servicios que forman parte de al menos un producto como componente. Los que no se usan no afectan a ningún producto si los desactivas.</p>} />
        <TintTile icon={CalendarClock} tone="sun" label="Próximo vencimiento" value={next ? formatDate(next.valid_to) : "—"} note={next ? next.name : "Ningún servicio activo por vencer"} info={<p>El servicio activo cuya vigencia termina antes. Al vencer, bloquea la activación de los productos que lo incluyen.</p>} />
        <TintTile icon={Building2} tone="ok" label="Proveedores" value={providers.size} note={`${activeProviders} activos con contrato vigente`} info={<p>Proveedores distintos que tienen al menos un servicio registrado.</p>} />
        <TintTile icon={Truck} tone="violet" label="Tipos de servicio" value={Object.keys(typeCounts).length} note={commonType ? `El más común: ${commonType[0].toLowerCase()} (${commonType[1]})` : "Sin servicios"} info={<p>Tipos distintos entre los servicios registrados: traslado, tren, entrada, guía, alojamiento y otros.</p>} />
      </section>
      <Card>
        <ServicesTable overview={overview} />
      </Card>
    </>
  );
}
