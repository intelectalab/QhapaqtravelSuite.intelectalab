import { Boxes, CircleCheck, Hourglass, Truck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { ServiceCreateAction } from "@/features/catalog-services/ServiceForms";
import { ServicesTable } from "@/features/catalog-services/ServicesTable";
import type { ServicesOverview } from "@/lib/catalog-services";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServiciosPage() {
  const overview = await getResource<ServicesOverview>("/catalog/services", "No pudimos cargar los servicios.");

  if (!overview) {
    return <PageHeader title="Servicios" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const services = overview.services;
  const active = services.filter((service) => service.state === "activo");
  const expiring = active.filter((service) => service.expires_in <= 90);
  const types = new Set(services.map((service) => service.type));
  const used = services.filter((service) => service.products.length > 0);

  return (
    <>
      <PageHeader
        title="Servicios"
        subtitle="Lo que compras a tus proveedores para armar cada producto."
        info={<InfoTip>Un servicio vencido o de un proveedor inactivo no se puede usar como componente, y bloquea la activación de los productos que lo incluyen.</InfoTip>}
        actions={overview.can.manage ? <ServiceCreateAction overview={overview} /> : undefined}
      />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={CircleCheck} tone="ok" label="Activos" value={active.length} note={`de ${services.length} servicios`} />
        <TintTile icon={Hourglass} tone="sun" label="Vencen en 90 días" value={expiring.length} note={expiring.length ? "Renueva tarifas con tiempo" : "Nada por renovar"} />
        <TintTile icon={Boxes} tone="t1" label="En productos" value={used.length} note={`${services.length - used.length} sin usar todavía`} />
        <TintTile icon={Truck} tone="violet" label="Tipos de servicio" value={types.size} note={`${new Set(services.map((service) => service.provider.id)).size} proveedores`} />
      </section>
      <Card>
        <ServicesTable overview={overview} />
      </Card>
    </>
  );
}
