import type { Metadata } from "next";
import { AutomationBoard } from "@/features/marketing/AutomationBoard";
import type { AutomationsOverview } from "@/lib/marketing";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Automatizaciones de marketing" };

export default async function SectionPage() {
  const overview = await getCachedResource<AutomationsOverview>("/marketing/automations", "No pudimos cargar las automatizaciones.");
  if (!overview) return null;
  return <AutomationBoard overview={overview} />;
}
