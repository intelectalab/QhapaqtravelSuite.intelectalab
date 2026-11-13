import type { Metadata } from "next";
import { ScriptsSection } from "@/features/tracking/TrackingScripts";
import { getCachedResource } from "@/lib/server/resource";
import type { TrackingOverview } from "@/lib/tracking";

export const metadata: Metadata = { title: "Scripts propios" };

export default async function ScriptsPage() {
  const overview = await getCachedResource<TrackingOverview>("/marketing/tracking/tags", "No pudimos cargar las etiquetas del sitio.");
  if (!overview) return null;

  return <ScriptsSection rows={overview.rows.filter((row) => row.provider === "script")} canManage={overview.can_manage} canApprove={overview.can_approve} me={overview.me} selfApprovalBlocked={overview.admins >= 2} />;
}
