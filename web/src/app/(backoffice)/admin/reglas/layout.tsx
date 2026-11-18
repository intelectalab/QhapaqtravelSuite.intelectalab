import type { ReactNode } from "react";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { RuleCreateAction, RuleResetAllAction } from "@/features/admin/Rules";
import { getRules } from "@/lib/server/adminSections";

const BASE = "/admin/reglas";

export default async function ReglasLayout({ children }: { children: ReactNode }) {
  const data = await getRules();
  if (!data) return <NoAccess home="/dashboard" />;

  return (
    <>
      <PageHeader
        title="Reglas de reserva"
        subtitle="Qué permite y qué exige el motor de reservas en el sitio web, el widget, las cotizaciones y los portales."
        info={<InfoTip>Activa solo lo que tu agencia necesita: una regla apagada desaparece del sitio web, el widget y las cotizaciones. Las reglas estándar no se eliminan, se apagan. Los parámetros se validan con sus rangos y entre reglas, por ejemplo la edad máxima de infante frente a la mínima de niño.</InfoTip>}
        actions={
          data.can_manage ? (
            <span className="flex flex-wrap items-center gap-2">
              <RuleResetAllAction modified={data.rules.filter((rule) => rule.modified && !rule.custom).length} />
              <RuleCreateAction />
            </span>
          ) : undefined
        }
      />
      <TabbedCard
        tabs={[
          { href: BASE, label: "Reglas", count: data.rules.length },
          { href: `${BASE}/plantillas`, label: "Plantillas por tipo de negocio", count: data.templates.length },
          { href: `${BASE}/simulador`, label: "Simulador" },
          { href: `${BASE}/historial`, label: "Historial de cambios" },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
