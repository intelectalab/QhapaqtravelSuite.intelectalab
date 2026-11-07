import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { resetPlatformBranding, savePlatformBranding } from "@/app/plataforma/(consola)/configuracion/actions";
import { AuditTrail } from "@/features/admin/AdminParts";
import { BrandingStudio } from "@/features/admin/Branding";
import type { BrandingOverview } from "@/lib/admin";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Personalización" };

export default async function PlatformBrandingPage() {
  const data = await platformGet<BrandingOverview>("/branding");

  return (
    <>
      <PageHeader
        title="Personalización"
        subtitle="Los colores y el diseño de tarjetas de la consola de plataforma. Cada agencia personaliza los suyos por separado."
        info={<InfoTip>Configuración define cómo trabaja la plataforma; Personalización, cómo se ve la consola. El contraste se mide con la norma WCAG AA.</InfoTip>}
      />
      <BrandingStudio data={data} save={savePlatformBranding} reset={resetPlatformBranding} audience="el equipo de la plataforma" />
      <div className="mt-5">
        <AuditTrail entries={data.history} href="/plataforma/auditoria" empty="La apariencia de la consola aún no tiene cambios." />
      </div>
    </>
  );
}
