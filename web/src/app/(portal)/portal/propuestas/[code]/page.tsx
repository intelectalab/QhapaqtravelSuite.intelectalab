import type { Metadata } from "next";
import { PortalQuoteDetail } from "@/features/portal/PortalQuoteDetail";
import type { PortalQuote } from "@/lib/portal";
import { portalData, portalSession } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Propuesta" };

export default async function PortalQuotePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [session, quote] = await Promise.all([portalSession(), portalData<PortalQuote>(`/quotes/${encodeURIComponent(code)}`, "No pudimos cargar la propuesta.")]);
  return <PortalQuoteDetail quote={quote} clientName={session?.client.name ?? ""} />;
}
