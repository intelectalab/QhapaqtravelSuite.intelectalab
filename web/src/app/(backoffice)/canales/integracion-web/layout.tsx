import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { WebTiles } from "@/features/channels/WebIntegration";
import type { WebOverview } from "@/lib/channels";
import { getCachedResource } from "@/lib/server/resource";

export default async function WebIntegrationLayout({ children }: { children: ReactNode }) {
  const overview = await getCachedResource<WebOverview>("/channels/widget", "No pudimos cargar la integración web.");

  if (!overview) {
    return <PageHeader title="Integración web y CMS" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Integración web y CMS"
        subtitle="Lleva el motor de reservas a tu sitio, tu blog o el de un aliado."
        info={<InfoTip>El widget usa la clave pública y solo responde en dominios verificados por DNS. Los precios y la disponibilidad salen del mismo motor que la tienda.</InfoTip>}
      />
      <WebTiles overview={overview} />
      <TabbedCard
        tabs={[
          { href: "/canales/integracion-web", label: "Configurador y vista previa" },
          { href: "/canales/integracion-web/metodos", label: "Métodos de integración" },
          { href: "/canales/integracion-web/dominios", label: "Dominios y seguridad", count: overview.domains.length },
          { href: "/canales/integracion-web/eventos", label: "Eventos" },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
