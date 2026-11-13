import type { Metadata } from "next";
import { ExternalReviewsWorkspace } from "@/features/channels/ExternalReviews";
import type { ExternalReviewsOverview, ReviewSourceAdmin } from "@/lib/channels";
import { getCachedResource, getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Conectores de reseñas" };

export default async function ExternalReviewConnectorsPage() {
  const overview = await getCachedResource<ExternalReviewsOverview>("/channels/external-reviews", "No pudimos cargar las reseñas externas.");
  if (!overview) return null;
  const managed = await getResource<ReviewSourceAdmin[]>("/integrations/review-sources", "No pudimos cargar los conectores.");
  return <ExternalReviewsWorkspace overview={overview} section="connectors" managed={managed} />;
}
