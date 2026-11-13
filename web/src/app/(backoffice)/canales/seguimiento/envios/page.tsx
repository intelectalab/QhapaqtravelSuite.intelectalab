import type { Metadata } from "next";
import { DispatchesTable } from "@/features/tracking/TrackingDispatches";
import { getCachedResource } from "@/lib/server/resource";
import type { DispatchList, TrackingOverview } from "@/lib/tracking";

export const metadata: Metadata = { title: "Envíos de conversiones" };

export default async function EnviosPage() {
  const [overview, dispatches] = await Promise.all([
    getCachedResource<TrackingOverview>("/marketing/tracking/tags", "No pudimos cargar las etiquetas del sitio."),
    getCachedResource<DispatchList>("/marketing/tracking/dispatches", "No pudimos cargar los envíos."),
  ]);
  if (!overview || !dispatches) return null;

  return <DispatchesTable rows={dispatches.rows} canManage={overview.can_manage} />;
}
