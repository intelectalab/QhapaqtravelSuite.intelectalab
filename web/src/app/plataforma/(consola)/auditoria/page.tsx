import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { InfoTip } from "@/components/ui/InfoTip";
import { AuditKpis } from "@/features/platform/AuditKpis";
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
        info={<InfoTip>El registro es de solo lectura: nadie puede editarlo ni borrarlo. Se muestran los 500 eventos más recientes. La exportación trae hasta 5000 eventos de los últimos 30 días en CSV y queda registrada.</InfoTip>}
        actions={<DownloadButton href="/plataforma/auditoria/exportar?days=30" label="Exportar 30 días" pendingLabel="Exportando…" />}
      />
      <AuditKpis events={events} />
      <AuditTable events={events} />
    </>
  );
}
