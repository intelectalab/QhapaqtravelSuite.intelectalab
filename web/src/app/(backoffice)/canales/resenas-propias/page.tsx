import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { OwnReviewSummary, OwnReviewTiles, OwnReviewsWorkspace } from "@/features/channels/OwnReviews";
import type { OwnReviewsOverview } from "@/lib/channels";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Reseñas de clientes" };

export default async function OwnReviewsPage() {
  const overview = await getResource<OwnReviewsOverview>("/channels/own-reviews", "No pudimos cargar las reseñas.");

  if (!overview) {
    return <PageHeader title="Reseñas de clientes" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Reseñas de clientes"
        subtitle={overview.own_only ? "Opiniones de los viajeros de tu cartera." : "Opiniones de viajeros con reserva real, listas para el sitio y el widget."}
        info={<InfoTip>Solo opinan pasajeros de viajes realizados. Se publica con el consentimiento del viajero; rechazar u ocultar exige un motivo y la nota nunca lo es.</InfoTip>}
      />
      <OwnReviewTiles kpis={overview.kpis} />
      <OwnReviewSummary overview={overview} />
      <OwnReviewsWorkspace overview={overview} />
    </>
  );
}
