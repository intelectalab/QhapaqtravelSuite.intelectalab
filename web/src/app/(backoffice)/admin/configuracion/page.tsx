import { Hash, History, Layers, Radio } from "lucide-react";
import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { AuditTrail, KpiGrid } from "@/features/admin/AdminParts";
import { SequencesTable, SettingsSections } from "@/features/admin/Settings";
import type { SettingsOverview } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const data = await getResource<SettingsOverview>("/admin/settings", "No pudimos cargar la configuración.");
  if (!data) return <NoAccess home="/dashboard" />;

  return (
    <>
      <PageHeader
        title="Configuración"
        subtitle={`Cómo trabaja ${data.agency.commercial_name}: datos, moneda, políticas, operación y canales.`}
        info={<InfoTip>Solo se guardan los campos que cambias y cada uno queda en la auditoría. Los cambios aplican a documentos nuevos; las cotizaciones, reservas y pagos ya emitidos conservan sus valores.</InfoTip>}
      />
      <KpiGrid>
        <TintTile icon={Layers} tone="t1" label="Plan" value={data.agency.plan} note={`Subdominio ${data.agency.subdomain}`} />
        <TintTile icon={Radio} tone="t4" label="Canales activos" value={`${data.kpis.channels_on} de ${data.kpis.channels_allowed}`} note="Incluidos en tu plan" />
        <TintTile icon={Hash} tone="sun" label="Series de documentos" value={data.kpis.sequences} note="Correlativos que solo avanzan" />
        <TintTile icon={History} tone="violet" label="Cambios en 30 días" value={data.kpis.changes_30d} note={data.kpis.updated_at ? `Último: ${formatDateTime(data.kpis.updated_at, false)}` : undefined} />
      </KpiGrid>
      <SettingsSections data={data} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={Hash} title="Series y correlativos" aside={`${data.sequences.length} series`} />
          <SequencesTable rows={data.sequences} manage={data.can_manage} />
        </Card>
        <AuditTrail entries={data.history} empty="Todavía no hay cambios de configuración." />
      </div>
    </>
  );
}
