import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { SectionLayout } from "@/components/ui/SectionNav";
import { TemplatesKpis, TemplatesNav } from "@/features/platform/SiteTemplatesAdmin";
import { getTemplateSubmissions, getTemplatesAdmin } from "@/lib/server/siteTemplatesAdmin";

export default async function PlantillasLayout({ children }: { children: ReactNode }) {
  const [overview, submissions] = await Promise.all([getTemplatesAdmin(), getTemplateSubmissions()]);

  return (
    <>
      <PageHeader
        title="Plantillas web"
        subtitle="Catálogo de diseños para el sitio público de las agencias, sus envíos a revisión y los paquetes de contenido con IA."
        info={<InfoTip>Cada versión pasa validaciones automáticas (manifiesto, build, Lighthouse, contraste, idiomas, datos estructurados y seguridad) y la revisión visual antes de publicarse en la galería.</InfoTip>}
      />
      <TemplatesKpis overview={overview} />
      <SectionLayout nav={<TemplatesNav overview={overview} submissions={submissions.filter((item) => item.status === "recibida" || item.status === "validando").length} />}>{children}</SectionLayout>
    </>
  );
}
