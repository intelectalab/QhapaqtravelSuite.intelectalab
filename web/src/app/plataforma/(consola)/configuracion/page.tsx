import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { AuditTrail } from "@/features/admin/AdminParts";
import { PlatformSettingsSections } from "@/features/platform/PlatformSettings";
import type { PlatformSettingsOverview } from "@/lib/platform";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Configuración" };

export default async function PlatformConfigurationPage() {
  const data = await platformGet<PlatformSettingsOverview>("/settings");

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle="Cómo trabaja la plataforma: el emisor de las facturas, los impuestos y los avisos automáticos a las agencias."
        info={<InfoTip>Solo se guardan los campos que cambias y cada uno queda en la auditoría. Los cambios aplican a facturas y avisos nuevos.</InfoTip>}
      />
      <PlatformSettingsSections data={data} />
      <div className="mt-5">
        <AuditTrail entries={data.history} href="/plataforma/auditoria" empty="Todavía no hay cambios de configuración." />
      </div>
    </>
  );
}
