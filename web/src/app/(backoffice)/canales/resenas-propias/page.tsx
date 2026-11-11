import type { Metadata } from "next";
import { OwnReviewSummary } from "@/features/channels/OwnReviews";
import type { OwnReviewsOverview } from "@/lib/channels";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Reseñas de clientes" };

export default async function SectionPage() {
  const overview = await getCachedResource<OwnReviewsOverview>("/reviews", "No pudimos cargar las reseñas.");
  if (!overview) return null;
  return <OwnReviewSummary overview={overview} />;
}
