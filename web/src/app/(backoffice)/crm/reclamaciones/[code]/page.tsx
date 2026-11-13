import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AuditEntry } from "@/features/audit/AuditTimeline";
import { ClaimSheetView } from "@/features/claims/ClaimSheet";
import type { ClaimsOverview } from "@/lib/claims";
import { getCachedResource, getResource } from "@/lib/server/resource";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: `Hoja ${decodeURIComponent(code)}` };
}

export default async function ClaimSheetPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const key = decodeURIComponent(code);
  const overview = await getCachedResource<ClaimsOverview>("/crm/claim-book", "No pudimos cargar el libro de reclamaciones.");
  if (!overview) return null;
  const sheet = overview.claims.find((claim) => claim.code === key || claim.book_number === key);

  if (!sheet) {
    return <EmptyState icon={<SearchX size={22} />} title={`La hoja ${key} no existe`} description="Revisa el número o vuelve al listado del libro." />;
  }

  const audit = await getResource<AuditEntry[]>(`/crm/claim-book/${encodeURIComponent(sheet.code)}/audit`, "No pudimos cargar la auditoría.");
  return <ClaimSheetView sheet={sheet} overview={overview} audit={audit} />;
}
