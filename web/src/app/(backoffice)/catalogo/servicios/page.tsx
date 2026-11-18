import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
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

  return (
    <>
      <PageHeader
        title="Servicios"
        subtitle="Lo que compras a tus proveedores para armar cada producto."
        info={<InfoTip>Un servicio vencido o de un proveedor inactivo no se puede usar como componente, y bloquea la activación de los productos que lo incluyen.</InfoTip>}
        actions={overview.can.manage ? <ServiceCreateAction overview={overview} /> : undefined}
      />
      <ConsultModeNotice permissions={["catalog.providers.manage"]} what="registrar ni editar servicios" />
      <ServicesTable overview={overview} />
    </>
  );
}
