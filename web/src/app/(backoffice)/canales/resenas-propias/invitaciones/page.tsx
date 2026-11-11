import type { Metadata } from "next";
import { OwnReviewsWorkspace } from "@/features/channels/OwnReviews";
import type { OwnReviewSettings, OwnReviewsOverview } from "@/lib/channels";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Invitaciones a reseñar" };

export default async function SectionPage() {
  const [overview, settings] = await Promise.all([getCachedResource<OwnReviewsOverview>("/reviews", "No pudimos cargar las reseñas."), getCachedResource<OwnReviewSettings>("/settings/own-reviews", "No pudimos cargar los ajustes.")]);
  if (!overview) return null;
  return <OwnReviewsWorkspace overview={overview} settings={overview.can_moderate ? settings : null} section="requests" />;
}
