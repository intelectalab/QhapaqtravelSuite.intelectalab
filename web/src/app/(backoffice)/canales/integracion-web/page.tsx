import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { DomainsTable, EventsCard, WebTiles, WidgetCard } from "@/features/channels/WebIntegration";
import type { WebOverview } from "@/lib/channels";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Integración web y CMS" };

export default async function IntegracionWebPage() {
  const overview = await getResource<WebOverview>("/channels/web", "No pudimos cargar la integración web.");

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
      <WebTiles kpis={overview.kpis} />
      <WidgetCard overview={overview} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <DomainsTable rows={overview.domains} canManage={overview.can_manage} />
        <EventsCard events={overview.events} />
      </div>
    </>
  );
}
