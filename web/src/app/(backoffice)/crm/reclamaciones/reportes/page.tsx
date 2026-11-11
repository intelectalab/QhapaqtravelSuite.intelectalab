import type { Metadata } from "next";
import { ClaimsWorkspace } from "@/features/claims/ClaimSections";
import type { ClaimsOverview } from "@/lib/claims";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Reportes del libro de reclamaciones" };

export default async function ClaimReportsPage() {
  const overview = await getCachedResource<ClaimsOverview>("/crm/claim-book", "No pudimos cargar el libro de reclamaciones.");
  if (!overview) return null;
  return <ClaimsWorkspace overview={overview} section="reports" />;
}
