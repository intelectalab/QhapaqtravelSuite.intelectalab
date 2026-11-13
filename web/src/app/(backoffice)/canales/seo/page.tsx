import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { BrandTabs, BrandTiles } from "@/features/vitrina/SiteBrand";
import { getResource } from "@/lib/server/resource";
import type { DomainsOverview, RedirectsOverview, SeoOverview } from "@/lib/vitrina";

export const metadata: Metadata = { title: "Dominio y SEO" };

export default async function SiteBrandPage() {
  const [domains, seo, redirects] = await Promise.all([
    getResource<DomainsOverview>("/cms/domains", "No pudimos cargar los dominios."),
    getResource<SeoOverview>("/cms/seo/pages", "No pudimos cargar la auditoría SEO."),
    getResource<RedirectsOverview>("/cms/redirects", "No pudimos cargar las redirecciones."),
  ]);

  if (!domains || !seo || !redirects) {
    return <PageHeader title="Dominio y SEO" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Dominio y SEO"
        subtitle="Su sitio con su dominio, certificado SSL automático, auditoría por página, redirecciones y sitemap."
        info={<InfoTip>Incluido en Enterprise; en Starter y Professional con el add-on «SEO y blog de aventuras». Un dominio pertenece a una sola agencia.</InfoTip>}
      />
      <BrandTiles domains={domains} seo={seo} redirects={redirects} />
      <BrandTabs domains={domains} seo={seo} redirects={redirects} />
    </>
  );
}
