import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { SectionLayout } from "@/components/ui/SectionNav";
import { AuditTrail } from "@/features/admin/AdminParts";
import { BrandingStudio } from "@/features/admin/Branding";
import { PersonalizationNav } from "@/features/admin/site/PersonalizationNav";
import { PERSONALIZATION_SECTIONS } from "@/features/admin/site/sections";
import { SiteLocked } from "@/features/admin/site/SiteLocked";
import { SiteStudio } from "@/features/admin/site/SiteStudio";
import type { BrandingOverview } from "@/lib/admin";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "@/lib/server/api";
import { getResource } from "@/lib/server/resource";
import type { SiteDesignOverview } from "@/lib/site-design";

export const metadata: Metadata = { title: "Personalización" };

export default async function PersonalizacionPage({ searchParams }: PageProps<"/admin/personalizacion">) {
  const raw = (await searchParams).seccion;
  const section = PERSONALIZATION_SECTIONS.find((id) => id === raw) ?? "panel";

  if (section === "panel") {
    const data = await getResource<BrandingOverview>("/admin/branding", "No pudimos cargar la personalización.");
    if (!data) return <NoAccess home="/dashboard" />;
    return (
      <>
        <Header subtitle={`Cómo se ven el panel de ${data.agency.name} y su sitio web.`} />
        <SectionLayout nav={<PersonalizationNav active={section} />}>
          <BrandingStudio data={data} />
          <div className="mt-5">
            <AuditTrail entries={data.history} empty="La apariencia aún no tiene cambios." />
          </div>
        </SectionLayout>
      </>
    );
  }

  const result = await apiFetch<SiteDesignOverview>("/admin/site-design");
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "FEATURE_NOT_IN_PLAN") {
    return (
      <>
        <Header subtitle="El sitio web de tu agencia." />
        <SectionLayout nav={<PersonalizationNav active={section} />}>
          <SiteLocked />
        </SectionLayout>
      </>
    );
  }
  if (result.status === 403) return <NoAccess home="/dashboard" />;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar el diseño del sitio.");

  return (
    <>
      <Header subtitle={`El sitio web de ${result.data.site.name}: cambia lo que quieras y míralo al lado antes de publicarlo.`} />
      <SiteStudio data={result.data} section={section} />
    </>
  );
}

function Header({ subtitle }: { subtitle: string }) {
  return (
    <PageHeader
      title="Personalización"
      subtitle={subtitle}
      info={<InfoTip>Configuración define cómo trabaja tu agencia; Personalización, cómo se ve. Los cambios del sitio web se guardan como borrador y solo los ven tus clientes cuando los publicas.</InfoTip>}
    />
  );
}
