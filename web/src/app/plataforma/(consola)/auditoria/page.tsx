import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { AuditTable } from "@/features/platform/AuditTable";
import { listPlatformAudit } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Auditoría de plataforma" };

export default async function AuditoriaPage() {
  const events = await listPlatformAudit();

  return (
    <>
      <PageHeader
        title="Auditoría"
        subtitle="Acciones del equipo de plataforma y eventos de las agencias: altas, planes, suspensiones, cobros y accesos."
        info={<InfoTip>El registro es de solo lectura: nadie puede editarlo ni borrarlo. Se muestran los 500 eventos más recientes.</InfoTip>}
      />
      <AuditTable events={events} />
    </>
  );
}
