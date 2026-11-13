import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { WhatsappBoard } from "@/features/growth/WhatsappTemplates";
import type { WhatsappOverview } from "@/lib/growth";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "WhatsApp Business" };

export default async function WhatsappPage() {
  const overview = await getCachedResource<WhatsappOverview>("/inbox/whatsapp-templates", "No pudimos cargar las plantillas de WhatsApp.");

  if (!overview) {
    return <PageHeader title="WhatsApp Business" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="WhatsApp Business"
        subtitle="Número conectado y plantillas transaccionales aprobadas por Meta."
        info={<InfoTip>Fuera de la ventana de 24 horas desde el último mensaje del cliente, WhatsApp solo permite plantillas aprobadas. Antes del primer mensaje, el cliente debe haber autorizado el canal.</InfoTip>}
      />
      <WhatsappBoard overview={overview} />
    </>
  );
}
