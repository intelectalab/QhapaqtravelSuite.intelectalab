import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { AuditTrail } from "@/features/admin/AdminParts";
import { GroupPulse, RuleCreateAction, RulesTable } from "@/features/admin/Rules";
import { latest, type RulesOverview } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Reglas de reserva" };

export default async function ReglasPage() {
  const data = await getResource<RulesOverview>("/admin/booking-rules", "No pudimos cargar las reglas.");
  if (!data) return <NoAccess home="/dashboard" />;
  const active = data.rules.filter((rule) => rule.enabled).length;
  const updated = latest(data.rules.map((rule) => rule.updated_at));
  const last = updated ? formatDateTime(updated, false) : null;

  return (
    <>
      <PageHeader
        title="Reglas de reserva"
        subtitle={`${active} de ${data.rules.length} reglas activas · plan ${data.plan}${last ? ` · último cambio ${last}` : ""}`}
        info={<InfoTip>Activa solo lo que tu agencia necesita: una regla apagada desaparece del sitio web, el widget y las cotizaciones. Las reglas estándar no se eliminan, se apagan. Los parámetros se validan con sus rangos y entre reglas, por ejemplo la edad máxima de infante frente a la mínima de niño.</InfoTip>}
        actions={data.can_manage ? <RuleCreateAction /> : undefined}
      />
      <GroupPulse groups={data.groups} />
      <RulesTable rules={data.rules} manage={data.can_manage} />
      <div className="mt-5">
        <AuditTrail entries={data.history} empty="Aún no hay cambios en las reglas." />
      </div>
    </>
  );
}
