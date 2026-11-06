import type { Metadata } from "next";
import { PortalQuotes } from "@/features/portal/PortalQuotes";
import type { PortalQuoteSummary } from "@/lib/portal";
import { portalData } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Propuestas" };

export default async function PortalQuotesPage() {
  const { quotes } = await portalData<{ quotes: PortalQuoteSummary[] }>("/quotes", "No pudimos cargar tus propuestas.");
  return <PortalQuotes quotes={quotes} />;
}
