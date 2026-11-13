import { BadgeCheck, ShieldCheck, UserPen } from "lucide-react";
import type { ReactNode } from "react";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintTile } from "@/components/ui/Tinted";
import { KpiGrid } from "@/features/admin/AdminParts";
import { RuleCreateAction, RuleResetAllAction } from "@/features/admin/Rules";
import { formatDateTime } from "@/lib/format";
import { getRules } from "@/lib/server/adminSections";

const BASE = "/admin/reglas";

export default async function ReglasLayout({ children }: { children: ReactNode }) {
  const data = await getRules();
  if (!data) return <NoAccess home="/dashboard" />;
  const last = [...data.rules].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const applied = data.template_applied;

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
      <KpiGrid columns={3}>
        <TintTile icon={ShieldCheck} tone="t1" label="Tu plan" value={data.plan} note="Define qué reglas puedes encender" info={<p>Plan contratado por la agencia. Cada regla indica desde qué plan está disponible; las de planes superiores se ven con candado.</p>} />
        <TintTile icon={BadgeCheck} tone="violet" label="Plantilla aplicada" value={applied?.name ?? "Ninguna"} note={applied ? `${formatDateTime(applied.at, false)}${applied.by ? ` · ${applied.by}` : ""}` : "Configuración a medida"} info={<p>Última plantilla por tipo de negocio aplicada según la auditoría. Después puedes ajustar cada regla por separado.</p>} />
        <TintTile icon={UserPen} tone="t4" label="Último cambio" value={last ? formatDateTime(last.updated_at, false) : "Sin cambios"} note={last ? `${last.name}${last.updated_by ? ` · ${last.updated_by}` : ""}` : undefined} info={<p>La regla modificada más recientemente, con quién la cambió.</p>} />
      </KpiGrid>
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
