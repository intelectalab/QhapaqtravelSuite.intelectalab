import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { OperationsKpis, OperationsSection } from "@/features/platform/OperationsBoard";
import { getOperations } from "@/lib/server/platformConsole";

export default async function IntegracionesLayout({ children }: { children: ReactNode }) {
  const overview = await getOperations();

  return (
    <>
      <PageHeader
        title="Integraciones y tareas"
        subtitle="Tareas programadas de la plataforma, estado de las colas, salud técnica de cada agencia y sus fallas de integración."
        info={<InfoTip>Solo se muestran metadatos técnicos: nunca datos comerciales de las agencias. Las tareas de cobranza y métricas se pueden ejecutar a mano; el resto corre solo en su horario.</InfoTip>}
      />
      <OperationsKpis overview={overview} />
      <OperationsSection overview={overview}>{children}</OperationsSection>
    </>
  );
}
