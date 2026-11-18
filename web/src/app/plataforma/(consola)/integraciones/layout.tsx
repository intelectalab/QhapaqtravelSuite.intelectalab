import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { SectionLayout } from "@/components/ui/SectionNav";
import { IntegrationsNav } from "@/features/platform/OperationsBoard";
import { getOperations } from "@/lib/server/platformConsole";

export default async function IntegracionesLayout({ children }: { children: ReactNode }) {
  const overview = await getOperations();

  return (
    <>
      <PageHeader
        title="Integraciones y tareas"
        subtitle="Monitoreo de las tareas, las colas y la salud de cada agencia, y las conexiones de la plataforma con sus proveedores."
        info={<InfoTip>Solo se muestran metadatos técnicos: nunca datos comerciales de las agencias. Las claves de cada conexión se guardan cifradas y cada cambio queda en la auditoría.</InfoTip>}
      />
      <SectionLayout nav={<IntegrationsNav errors={overview.errors.filter((error) => error.status !== "resuelto").length} />}>
        <section className="rounded-card border border-line bg-surface p-5 shadow-card [&_.shadow-card]:shadow-none">{children}</section>
      </SectionLayout>
    </>
  );
}
