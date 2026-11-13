import type { Metadata } from "next";
import { ClaimsWorkspace } from "@/features/claims/ClaimSections";
import type { ClaimReport, ClaimsOverview } from "@/lib/claims";
import { getCachedResource, getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Reportes del libro de reclamaciones" };

export default async function ClaimReportsPage() {
  const [overview, report] = await Promise.all([
    getCachedResource<ClaimsOverview>("/crm/claim-book", "No pudimos cargar el libro de reclamaciones."),
    getResource<ClaimReport>("/crm/claim-book/reports", "No pudimos cargar el cumplimiento del plazo."),
  ]);
  if (!overview) return null;
  return <ClaimsWorkspace overview={overview} section="reports" report={report} />;
}
