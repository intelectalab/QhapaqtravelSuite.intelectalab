import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { ClaimFormAction } from "@/features/claims/ClaimForms";
import { ClaimTiles } from "@/features/claims/ClaimSections";
import type { ClaimsOverview } from "@/lib/claims";
import { getCachedResource } from "@/lib/server/resource";

export default async function ClaimBookLayout({ children }: { children: ReactNode }) {
  const overview = await getCachedResource<ClaimsOverview>("/crm/claim-book", "No pudimos cargar el libro de reclamaciones.");

  if (!overview) {
    return <PageHeader title="Libro de reclamaciones" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { settings } = overview;

  return (
    <>
      <PageHeader
        title="Libro de reclamaciones"
        subtitle={`Hojas de reclamación y queja con plazo de respuesta de ${settings.response_days} días hábiles.`}
        info={<InfoTip>Cada hoja lleva un correlativo por sede y se conserva {settings.retention_years} años. Las alertas se activan {settings.alert_days} días hábiles antes del vencimiento. Valida los plazos vigentes con asesoría legal.</InfoTip>}
        actions={overview.can.manage ? <ClaimFormAction overview={overview} /> : undefined}
      />
      <ClaimTiles overview={overview} />
      <TabbedCard
        tabs={[
          { href: "/crm/reclamaciones", label: "Hojas de reclamación", count: overview.claims.length },
          { href: "/crm/reclamaciones/reportes", label: "Reportes" },
          { href: "/crm/reclamaciones/configuracion", label: "Configuración" },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
