import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { AuditTrail } from "@/features/admin/AdminParts";
import { BrandingStudio } from "@/features/admin/Branding";
import type { BrandingOverview } from "@/lib/admin";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Personalización" };

export default async function PersonalizacionPage() {
  const data = await getResource<BrandingOverview>("/admin/branding", "No pudimos cargar la personalización.");
  if (!data) return <NoAccess home="/dashboard" />;

  return (
    <>
      <PageHeader
        title="Personalización"
        subtitle={`Los colores y el diseño de tarjetas de ${data.agency.name}.`}
        info={<InfoTip>Configuración define cómo trabaja tu agencia; Personalización, cómo se ve. Revisa la vista previa antes de guardar: el contraste se mide con la norma WCAG AA.</InfoTip>}
      />
      <BrandingStudio data={data} />
      <div className="mt-5">
        <AuditTrail entries={data.history} empty="La apariencia aún no tiene cambios." />
      </div>
    </>
  );
}
