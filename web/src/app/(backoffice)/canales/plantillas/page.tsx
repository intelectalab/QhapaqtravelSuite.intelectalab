import type { Metadata } from "next";
import { Eye } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { ActiveTheme, SiteTemplateTiles, TemplateGallery } from "@/features/channels/SiteTemplates";
import { getCachedResource } from "@/lib/server/resource";
import type { GalleryTemplate, ThemeOverview } from "@/lib/siteTemplates";

export const metadata: Metadata = { title: "Plantillas del sitio" };

export default async function PlantillasPage({ searchParams }: PageProps<"/canales/plantillas">) {
  const [theme, gallery, params] = await Promise.all([getCachedResource<ThemeOverview>("/cms/theme", "No pudimos cargar la plantilla del sitio."), getCachedResource<GalleryTemplate[]>("/cms/templates", "No pudimos cargar la galería."), searchParams]);

  if (!theme || !gallery) {
    return <PageHeader title="Plantillas del sitio" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const applyCode = typeof params.aplicar === "string" ? params.aplicar : undefined;

  return (
    <>
      <PageHeader
        title="Plantillas del sitio"
        subtitle="Elija el diseño de su sitio público y véalo con sus propios datos antes de aplicarlo."
        info={<InfoTip>Cambiar de plantilla solo cambia la presentación: sus tours, precios, reservas, blog, SEO y dominio quedan igual. Puede volver a la anterior desde el historial.</InfoTip>}
        actions={
          <Button href={`/sitio/${theme.subdomain}`} icon={<Eye size={16} />}>
            Ver mi sitio
          </Button>
        }
      />
      <SiteTemplateTiles theme={theme} gallery={gallery} />
      <ActiveTheme theme={theme} />
      <TemplateGallery gallery={gallery} theme={theme} applyCode={applyCode} />
    </>
  );
}
