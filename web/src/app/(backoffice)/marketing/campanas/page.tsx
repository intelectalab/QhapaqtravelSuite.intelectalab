import type { Metadata } from "next";
import { MarketingWorkspace } from "@/features/marketing/MarketingWorkspace";
import type { MarketingOverview } from "@/lib/marketing";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Campañas" };

export default async function SectionPage() {
  const overview = await getCachedResource<MarketingOverview>("/marketing/campaigns", "No pudimos cargar marketing.");
  if (!overview) return null;
  return <MarketingWorkspace overview={overview} section="campaigns" />;
}
