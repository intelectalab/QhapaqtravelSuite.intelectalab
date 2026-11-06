import { Award } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { ExternalInbox, ExternalTiles, SourcesGrid } from "@/features/channels/ExternalReviews";
import type { ExternalReviewsOverview } from "@/lib/channels";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Reseñas externas" };

export default async function ExternalReviewsPage() {
  const overview = await getResource<ExternalReviewsOverview>("/channels/external-reviews", "No pudimos cargar las reseñas externas.");

  if (!overview) {
    return <PageHeader title="Reseñas externas" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Reseñas externas"
        subtitle="Lo que dicen de tu agencia en Google, TripAdvisor y otras plataformas, en una sola bandeja."
        info={<InfoTip>Se leen por las APIs oficiales de cada plataforma, sin copiar páginas. Las respuestas se publican por API cuando la plataforma lo permite; si no, se copian a mano y se marcan como publicadas.</InfoTip>}
        actions={
          <Button href="/canales/resenas-propias" variant="secondary" icon={<Award size={16} />} iconOnlyOnMobile>
            Reseñas de clientes
          </Button>
        }
      />
      <ExternalTiles kpis={overview.kpis} />
      <SourcesGrid sources={overview.sources} />
      <ExternalInbox overview={overview} />
    </>
  );
}
