import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PlatformShowcaseTabs, ShowcaseTiles } from "@/features/vitrina/PlatformShowcase";
import { platformGet } from "@/lib/server/platform";
import type { FunnelMonth, ModerationOverview, PostsOverview } from "@/lib/vitrina";

export const metadata: Metadata = { title: "Vitrina y blog SEO" };

export default async function PlatformShowcasePage() {
  const [overview, funnel, posts] = await Promise.all([
    platformGet<ModerationOverview>("/showcase/moderation"),
    platformGet<{ months: FunnelMonth[] }>("/showcase/funnel"),
    platformGet<PostsOverview>("/showcase/posts"),
  ]);

  return (
    <>
      <PageHeader
        title={`Vitrina ${overview.brand.name} y blog SEO`}
        subtitle={`Sitio gratuito multiagencia en ${overview.brand.domain} (nombre provisional). Atrae agencias y les muestra los beneficios de los planes.`}
        info={<InfoTip>Toda publicación pasa por moderación: fotos y textos propios, punto de encuentro real y agencia verificada con RUC y licencia. Rechazar exige un motivo que recibe la agencia.</InfoTip>}
      />
      <ShowcaseTiles overview={overview} />
      <PlatformShowcaseTabs overview={overview} funnel={funnel.months} posts={posts} />
    </>
  );
}
