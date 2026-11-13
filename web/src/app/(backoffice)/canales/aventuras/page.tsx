import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { StoriesTable, StoryFormAction, StoryTiles } from "@/features/vitrina/TravelStories";
import { getResource } from "@/lib/server/resource";
import type { StoriesOverview } from "@/lib/vitrina";

export const metadata: Metadata = { title: "Blog de aventuras" };

export default async function StoriesPage() {
  const overview = await getResource<StoriesOverview>("/cms/stories", "No pudimos cargar las historias.");

  if (!overview) {
    return <PageHeader title="Blog de aventuras" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Blog de aventuras"
        subtitle="Historias reales de viajes vendidos, con fotos y frases de sus clientes. Cada historia enlaza al tour para vender más."
        info={<InfoTip>Solo se publica con consentimiento registrado: quién autorizó, cuándo, por qué canal y si permite fotos y nombre. Si el cliente lo retira desde su portal, la historia se despublica en el momento.</InfoTip>}
        actions={<StoryFormAction overview={overview} />}
      />
      <StoryTiles overview={overview} />
      <StoriesTable overview={overview} />
    </>
  );
}
