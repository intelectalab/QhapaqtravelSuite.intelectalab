import type { Metadata } from "next";
import { ConsentBook } from "@/features/marketing/ConsentBook";
import type { ConsentsOverview } from "@/lib/marketing";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Consentimientos" };

export default async function SectionPage() {
  const overview = await getCachedResource<ConsentsOverview>("/marketing/contacts", "No pudimos cargar los consentimientos.");
  if (!overview) return null;
  return <ConsentBook overview={overview} />;
}
