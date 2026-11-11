import { Building2, Coins, Hash, History, Layers, Radio, ScrollText, Wrench } from "lucide-react";
import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { SectionLayout, SectionNav } from "@/components/ui/SectionNav";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { AuditTrail, KpiGrid } from "@/features/admin/AdminParts";
import { SequencesTable, SettingsSections, type SettingsView } from "@/features/admin/Settings";
import type { SettingsOverview } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { resolveSections } from "@/lib/sections";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Configuración" };

export default async function ConfiguracionPage({ searchParams }: PageProps<"/admin/configuracion">) {
  const [data, { seccion }] = await Promise.all([getResource<SettingsOverview>("/settings", "No pudimos cargar la configuración."), searchParams]);
  if (!data) return <NoAccess home="/dashboard" />;

  const { active, groups } = resolveSections(
    "/admin/configuracion",
    [
      { group: "Agencia", id: "agencia", label: "Datos y contacto", icon: <Building2 size={15} /> },
      { group: "Agencia", id: "moneda", label: "Moneda e impuestos", icon: <Coins size={15} /> },
      { group: "Cómo vende", id: "politicas", label: "Políticas comerciales", icon: <ScrollText size={15} /> },
      { group: "Cómo vende", id: "canales", label: "Canales", icon: <Radio size={15} />, count: data.kpis.channels_on },
      { group: "Cómo opera", id: "operacion", label: "Parámetros operativos", icon: <Wrench size={15} /> },
      { group: "Cómo opera", id: "series", label: "Series y correlativos", icon: <Hash size={15} />, count: data.sequences.length },
      { group: "Control", id: "historial", label: "Historial de cambios", icon: <History size={15} />, count: data.kpis.changes_30d || undefined },
    ],
    seccion,
  );

  const body =
    active === "series" ? (
      <Card>
        <TintCardTitle icon={Hash} title="Series y correlativos" aside={`${data.sequences.length} series`} />
        <SequencesTable rows={data.sequences} manage={data.can_manage} />
      </Card>
    ) : active === "historial" ? (
      <AuditTrail entries={data.history} empty="Todavía no hay cambios de configuración." />
    ) : (
      <SettingsSections data={data} show={active as SettingsView} />
    );

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
      <SectionLayout nav={<SectionNav label="Secciones de configuración" groups={groups} active={active} testId="settings-sections" />}>{body}</SectionLayout>
    </>
  );
}
