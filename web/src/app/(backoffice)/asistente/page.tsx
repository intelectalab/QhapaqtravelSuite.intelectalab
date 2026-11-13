import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { AssistantBoard } from "@/features/growth/AssistantBoard";
import type { AiUsage } from "@/lib/growth";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Asistente de ventas" };

export default async function AsistentePage() {
  const usage = await getCachedResource<AiUsage>("/ai/usage", "No pudimos cargar el asistente.");

  if (!usage) {
    return <PageHeader title="Asistente de ventas" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Asistente de ventas"
        subtitle="Itinerarios, borradores de cotización y respuestas a partir de un pedido en texto."
        info={<InfoTip>La IA nunca confirma, cobra ni envía sola. «Aplicar» deja la cotización en una versión en borrador que pasa por las reglas de precio y aprobación de siempre.</InfoTip>}
      />
      <AssistantBoard usage={usage} />
    </>
  );
}
