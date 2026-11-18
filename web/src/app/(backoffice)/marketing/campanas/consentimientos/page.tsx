import type { Metadata } from "next";
import { ConsentBook } from "@/features/marketing/ConsentBook";
import type { ConsentsOverview, MarketingOverview } from "@/lib/marketing";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Consentimientos" };

export default async function SectionPage() {
  const [overview, marketing] = await Promise.all([
    getCachedResource<ConsentsOverview>("/marketing/contacts", "No pudimos cargar los consentimientos."),
    getCachedResource<MarketingOverview>("/marketing/campaigns", "No pudimos cargar marketing."),
  ]);
  if (!overview || !marketing) return null;
  return <ConsentBook overview={overview} reach={{ email: marketing.kpis.contactable_email, whatsapp: marketing.kpis.contactable_whatsapp, revoked30: marketing.consents.revoked_30 }} />;
}
