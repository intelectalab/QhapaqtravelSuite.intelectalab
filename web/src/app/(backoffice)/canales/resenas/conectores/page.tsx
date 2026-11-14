import type { Metadata } from "next";
import { ExternalReviewsWorkspace } from "@/features/channels/ExternalReviews";
import { ReviewLinksCard } from "@/features/channels/ReviewLinks";
import type { ExternalReviewsOverview, ReviewLinksOverview, ReviewSourceAdmin } from "@/lib/channels";
import { getCachedResource, getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Conectores de reseñas" };

export default async function ExternalReviewConnectorsPage() {
  const overview = await getCachedResource<ExternalReviewsOverview>("/channels/external-reviews", "No pudimos cargar las reseñas externas.");
  if (!overview) return null;
  const [managed, links] = await Promise.all([
    getResource<ReviewSourceAdmin[]>("/integrations/review-sources", "No pudimos cargar los conectores."),
    getResource<ReviewLinksOverview>("/channels/review-links", "No pudimos cargar los enlaces de reseñas."),
  ]);
  return (
    <>
      {links && <ReviewLinksCard links={links} manage={overview.can_configure} />}
      <ExternalReviewsWorkspace overview={overview} section="connectors" managed={managed} />
    </>
  );
}
