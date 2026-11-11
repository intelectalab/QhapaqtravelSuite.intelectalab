import type { Metadata } from "next";
import { ClaimsWorkspace } from "@/features/claims/ClaimSections";
import type { ClaimsOverview } from "@/lib/claims";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Libro de reclamaciones" };

export default async function ClaimSheetsPage() {
  const overview = await getCachedResource<ClaimsOverview>("/crm/claim-book", "No pudimos cargar el libro de reclamaciones.");
  if (!overview) return null;
  return <ClaimsWorkspace overview={overview} section="sheets" />;
}
