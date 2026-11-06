import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { CmsFlow, CmsTable, ContentFormAction } from "@/features/channels/CmsContents";
import type { CmsOverview } from "@/lib/channels";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "CMS" };

export default async function CmsPage() {
  const overview = await getResource<CmsOverview>("/channels/cms", "No pudimos cargar los contenidos.");

  if (!overview) {
    return <PageHeader title="CMS" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="CMS"
        subtitle="Páginas, artículos, banners y textos legales del sitio web y los portales."
        info={<InfoTip>Solo lo publicado llega a los canales. Para publicar hace falta el título SEO; devolver o despublicar pide un motivo que queda en la bitácora.</InfoTip>}
        actions={overview.can_publish ? <ContentFormAction overview={overview} /> : undefined}
      />
      <CmsFlow kpis={overview.kpis} />
      <CmsTable overview={overview} />
    </>
  );
}
